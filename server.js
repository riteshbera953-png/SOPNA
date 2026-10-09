const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "10kb" }));

const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID;

app.get("/", (req, res) => {
  res.send("Firebase Notification Backend is running");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    telegramConfigured: Boolean(BOT_TOKEN && CHAT_ID)
  });
});

// Send a Telegram test notification
app.get("/api/telegram/test", async (req, res) => {
  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({
      ok: false,
      error: "Telegram environment variables are missing"
    });
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: "✅ Backend connected successfully!"
      }
    );

    res.json({ ok: true, message: "Telegram test sent" });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: "Telegram message failed"
    });
  }
});

// Receive a non-sensitive application event
app.post("/api/firebase/event", async (req, res) => {
  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({
      ok: false,
      error: "Telegram configuration missing"
    });
  }

  const { event } = req.body || {};

  if (typeof event !== "string" || event.length < 1 || event.length > 200) {
    return res.status(400).json({
      ok: false,
      error: "Provide a short, non-sensitive event string"
    });
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: `Firebase application event:\n${event}`
      }
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: "Notification could not be sent"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
