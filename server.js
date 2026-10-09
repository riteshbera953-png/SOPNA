const express = require("express");

const app = express();
app.use(express.json({ limit: "10kb" }));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID;

// Home route: check whether the backend is running
app.get("/", (req, res) => {
  res.send("BROTHERS PANEL — Firebase notification backend is running");
});

// Send a test message to your Telegram channel
app.post("/api/telegram/test", async (req, res) => {
  try {
    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({
        success: false,
        error: "Telegram environment variables are missing"
      });
    }

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text:
            "🔥 BROTHERS PANEL\n\n" +
            "✅ Telegram test notification successful!\n" +
            "🕒 Time: " + new Date().toISOString()
        })
      }
    );

    const result = await telegramResponse.json();

    if (!telegramResponse.ok || !result.ok) {
      return res.status(502).json({
        success: false,
        error: result.description || "Telegram delivery failed"
      });
    }

    return res.json({
      success: true,
      message: "Test notification sent successfully"
    });

  } catch (error) {
    console.error("Telegram notification error:", error.message);

    return res.status(500).json({
      success: false,
      error: "Unable to send Telegram notification"
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
