const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || process.env.CHANNEL_ID;

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

      if (body.length > 32 * 1024) {
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

async function sendTelegram(text) {
  if (!BOT_TOKEN || !CHANNEL_ID) {
    throw new Error('Telegram environment variables are not configured');
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
}

const server = http.createServer(async (req, res) => {

  // Serve index.html
  if (
    req.method === 'GET' &&
    (req.url === '/' || req.url === '/index.html')
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

  // Firebase connected notification
  if (
    req.method === 'POST' &&
    req.url === '/api/telegram/firebase-connected'
  ) {
    const now = Date.now();

    const ip = String(
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      'unknown'
    )
      .split(',')[0]
      .trim();

    const previous = lastNotify.get(ip) || 0;

    if (now - previous < 30000) {
      return json(res, 429, {
        ok: false,
        error: 'Rate limited'
      });
    }

    lastNotify.set(ip, now);

    try {
      const payload = JSON.parse(await readBody(req));

      if (
        !payload.firebaseUrl ||
        typeof payload.firebaseUrl !== 'string'
      ) {
        return json(res, 400, {
          ok: false,
          error: 'firebaseUrl is required'
        });
      }

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
        'Telegram notification error:',
        e.message
      );

      return json(res, 500, {
        ok: false,
        error: 'Telegram notification failed'
      });
    }
  }

  // Health check
  if (
    req.method === 'GET' &&
    req.url === '/health'
  ) {
    return json(res, 200, {
      ok: true,
      telegramConfigured: Boolean(
        BOT_TOKEN && CHANNEL_ID
      )
    });
  }

  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8'
  });

  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Brothers Panel listening on port ${PORT}`
  );
});
