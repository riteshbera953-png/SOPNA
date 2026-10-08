const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const CHANNEL_ID =
  process.env.TELEGRAM_CHANNEL_ID ||
  process.env.CHANNEL_ID ||
  process.env.TELEGRAM_CHAT_ID;

const indexPath = path.join(__dirname, 'index.html');
const lastNotify = new Map();

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;

      if (body.length > 64 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function maskUrl(raw) {
  try {
    const u = new URL(raw);
    return u.origin + u.pathname;
  } catch (_) {
    return String(raw || '').slice(0, 200);
  }
}

function configError() {
  if (!BOT_TOKEN && !CHANNEL_ID) {
    return 'Missing TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID in Render Environment Variables';
  }

  if (!BOT_TOKEN) {
    return 'Missing TELEGRAM_BOT_TOKEN in Render Environment Variables';
  }

  if (!CHANNEL_ID) {
    return 'Missing TELEGRAM_CHANNEL_ID in Render Environment Variables';
  }

  return null;
}

async function sendTelegram(text) {
  const error = configError();

  if (error) {
    throw new Error(error);
  }

  const response = await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(BOT_TOKEN)}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.ok) {
    throw new Error(
      result.description || `Telegram HTTP ${response.status}`
    );
  }

  return result;
}

async function parseJsonBody(req) {
  const raw = await readBody(req);

  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (_) {
    throw new Error('Invalid JSON body');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(
    req.url,
    `http://${req.headers.host || 'localhost'}`
  );

  const pathname = url.pathname;

  // Serve index.html
  if (
    req.method === 'GET' &&
    (pathname === '/' || pathname === '/index.html')
  ) {
    try {
      const html = fs.readFileSync(indexPath);

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });

      res.end(html);
    } catch (e) {
      json(res, 500, {
        ok: false,
        error: 'index.html not found'
      });
    }

    return;
  }

  // Health check
  if (req.method === 'GET' && pathname === '/health') {
    return json(res, 200, {
      ok: true,
      telegramConfigured: Boolean(BOT_TOKEN && CHANNEL_ID),
      port: PORT
    });
  }

  // Telegram test
  if (
    req.method === 'GET' &&
    pathname === '/api/telegram/test'
  ) {
    try {
      await sendTelegram(
        '<b>🔥 Brothers Panel</b>\n\n' +
        '<b>Telegram Test</b>\n' +
        '✅ Render backend can send messages.'
      );

      return json(res, 200, {
        ok: true,
        message: 'Telegram test message sent'
      });

    } catch (e) {
      console.error(
        'Telegram test error:',
        e.message
      );

      return json(res, 500, {
        ok: false,
        error: e.message
      });
    }
  }

  // Firebase connected notification
  if (
    req.method === 'POST' &&
    pathname === '/api/telegram/firebase-connected'
  ) {
    const ip = String(
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      'unknown'
    )
      .split(',')[0]
      .trim();

    const now = Date.now();
    const previous = lastNotify.get(ip) || 0;

    if (now - previous < 30000) {
      return json(res, 429, {
        ok: false,
        error: 'Rate limited. Try again after 30 seconds.'
      });
    }

    try {
      const payload = await parseJsonBody(req);

      if (
        !payload.firebaseUrl ||
        typeof payload.firebaseUrl !== 'string'
      ) {
        return json(res, 400, {
          ok: false,
          error: 'firebaseUrl is required'
        });
      }

      lastNotify.set(ip, now);

      const time = payload.time
        ? new Date(payload.time)
        : new Date();

      const timeText = Number.isNaN(time.getTime())
        ? new Date().toISOString()
        : time.toISOString();

      const message = [
        '<b>🔥 Brothers Panel</b>',
        '',
        '<b>Firebase Connected</b>',
        '',
        '<b>Firebase URL:</b>',
        escHtml(maskUrl(payload.firebaseUrl)),
        '',
        '<b>Time:</b>',
        escHtml(timeText)
      ].join('\n');

      await sendTelegram(message);

      return json(res, 200, {
        ok: true
      });

    } catch (e) {
      console.error(
        'Firebase notification error:',
        e.message
      );

      return json(res, 500, {
        ok: false,
        error: e.message
      });
    }
  }

  // Generic Telegram send endpoint
  if (
    req.method === 'POST' &&
    pathname === '/api/telegram/send'
  ) {
    try {
      const payload = await parseJsonBody(req);

      if (
        !payload.message ||
        typeof payload.message !== 'string'
      ) {
        return json(res, 400, {
          ok: false,
          error: 'message is required'
        });
      }

      const message = payload.message.slice(0, 4000);

      await sendTelegram(
        escHtml(message)
      );

      return json(res, 200, {
        ok: true
      });

    } catch (e) {
      console.error(
        'Telegram send error:',
        e.message
      );

      return json(res, 500, {
        ok: false,
        error: e.message
      });
    }
  }

  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8'
  });

  res.end('Not Found');
});

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `Brothers Panel listening on port ${PORT}`
    );
  }
);
