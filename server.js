const http = require('http');

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;

const CHANNEL_ID =
  process.env.TELEGRAM_CHANNEL_ID ||
  process.env.CHANNEL_ID ||
  process.env.TELEGRAM_CHAT_ID;

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });

  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let body = '';

  for await (const chunk of req) {
    body += chunk;

    if (body.length > 16384) {
      throw new Error('Request body too large');
    }
  }

  return body.trim() ? JSON.parse(body) : {};
}

async function sendTelegram(message) {
  if (!BOT_TOKEN || !CHANNEL_ID) {
    throw new Error('Telegram environment variables are missing');
  }

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        text: message,
        disable_web_page_preview: true
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      result.description || 'Telegram delivery failed'
    );
  }

  return result;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(
    req.url,
    `http://${req.headers.host || 'localhost'}`
  );

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, {
      ok: true,
      telegramConfigured: Boolean(BOT_TOKEN && CHANNEL_ID)
    });
  }

  if (
    req.method === 'GET' &&
    url.pathname === '/api/telegram/test'
  ) {
    try {
      await sendTelegram(
        'Brothers Panel\n\n' +
        'Telegram Test\n' +
        'Status: Connected'
      );

      return sendJson(res, 200, {
        ok: true,
        message: 'Test notification sent'
      });
    } catch (error) {
      console.error('Telegram test failed:', error.message);

      return sendJson(res, 500, {
        ok: false,
        error: error.message
      });
    }
  }

  if (
    req.method === 'POST' &&
    url.pathname === '/api/firebase/event'
  ) {
    try {
      const payload = await readJson(req);

      const event = String(
        payload.event || 'Firebase connection established'
      )
        .replace(/[<>]/g, '')
        .slice(0, 160);

      const time = new Date();

      await sendTelegram(
        'Brothers Panel\n\n' +
        'Firebase Connection Status\n' +
        'Event: ' + event + '\n' +
        'Time: ' + time.toISOString()
      );

      return sendJson(res, 200, {
        ok: true,
        message: 'Status notification sent'
      });
    } catch (error) {
      console.error(
        'Firebase status notification failed:',
        error.message
      );

      return sendJson(res, 500, {
        ok: false,
        error: error.message
      });
    }
  }

  return sendJson(res, 404, {
    ok: false,
    error: 'Route not found'
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
