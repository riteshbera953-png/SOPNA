const http = require("http");

const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID;

const lastRequests = new Map();

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.on("data", chunk => {
      size += chunk.length;

      if (size > 10000) {
        reject(new Error("Request too large"));
        req.destroy();
        return;
      }

      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

async function sendTelegram(message) {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error("Telegram configuration missing");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message
      }),
      signal: AbortSignal.timeout(10000)
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error("Telegram delivery failed");
  }

  return true;
}

function rateLimited(req) {
  const ip = String(
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "unknown"
  ).split(",")[0].trim();

  const now = Date.now();
  const previous = lastRequests.get(ip) || 0;

  if (now - previous < 3000) return true;

  lastRequests.set(ip, now);
  return false;
}

const server = http.createServer(async (req, res) => {
  const path = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  ).pathname;

  if (req.method === "GET" && path === "/") {
    return sendJson(res, 200, {
      ok: true,
      service: "Firebase Event Notification",
      telegramConfigured: Boolean(BOT_TOKEN && CHAT_ID)
    });
  }

  if (req.method === "GET" && path === "/health") {
    return sendJson(res, 200, {
      ok: true,
      telegramConfigured: Boolean(BOT_TOKEN && CHAT_ID)
    });
  }

  if (
    req.method === "POST" &&
    (
      path === "/api/telegram/firebase-connected" ||
      path === "/api/telegram/event"
    )
  ) {
    if (rateLimited(req)) {
      return sendJson(res, 429, {
        ok: false,
        error: "Please wait before trying again"
      });
    }

    try {
      const data = await readBody(req);

      let message;

      if (path === "/api/telegram/firebase-connected") {
        message = [
          "Firebase connection notification",
          "Status: Connected",
          `Time: ${new Date().toISOString()}`
        ].join("\n");
      } else {
        const allowedTypes = [
          "application_event",
          "status_update",
          "new_notification"
        ];

        if (!allowedTypes.includes(data.eventType)) {
          return sendJson(res, 400, {
            ok: false,
            error: "Unsupported event type"
          });
        }

        const status = String(data.status || "updated").slice(0, 80);
        const timestamp = String(
          data.timestamp || new Date().toISOString()
        ).slice(0, 80);

        message = [
          "Firebase Application Event",
          `Type: ${data.eventType}`,
          `Status: ${status}`,
          `Time: ${timestamp}`
        ].join("\n");
      }

      await sendTelegram(message);

      return sendJson(res, 200, {
        ok: true,
        message: "Telegram notification sent"
      });
    } catch (error) {
      console.error("Notification error:", error.message);

      return sendJson(res, 500, {
        ok: false,
        error: "Notification failed"
      });
    }
  }

  return sendJson(res, 404, {
    ok: false,
    error: "Not found"
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
