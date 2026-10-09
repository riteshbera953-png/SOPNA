const http = require("http");

const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID;

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

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 10000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
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
    throw new Error(result.description || "Telegram request failed");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  if (req.method === "GET" && url.pathname === "/") {
    return sendJson(res, 200, {
      ok: true,
      service: "Firebase Connection Notifier",
      telegramConfigured: Boolean(BOT_TOKEN && CHAT_ID)
    });
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      telegramConfigured: Boolean(BOT_TOKEN && CHAT_ID)
    });
  }

  if (
    req.method === "POST" &&
    url.pathname === "/api/telegram/firebase-connected"
  ) {
    try {
      const data = await readBody(req);

      if (
        typeof data.firebaseUrl !== "string" ||
        !/^https:\/\/[a-z0-9-]+\.firebaseio\.com\/?$/i.test(
          data.firebaseUrl
        ) &&
        !/^https:\/\/[a-z0-9-]+\.firebasedatabase\.app\/?$/i.test(
          data.firebaseUrl
        )
      ) {
        return sendJson(res, 400, {
          ok: false,
          error: "Invalid Firebase Realtime Database URL"
        });
      }

      await sendTelegram(
        "Firebase connection notification\n" +
        "Status: Connected\n" +
        "Time: " + new Date().toISOString()
      );

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
  console.log(`Server running on port ${PORT}`);
});
