const express = require("express");
const app = express();

app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID;

app.post("/api/firebase/forward", async (req, res) => {
  try {
    const { firebaseUrl } = req.body;

    if (!BOT_TOKEN || !CHAT_ID) {
      return res.status(500).json({
        success: false,
        error: "Telegram environment variables are missing"
      });
    }

    if (
      typeof firebaseUrl !== "string" ||
      !/^https:\/\/[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.firebasedatabase\.app\/?$/.test(firebaseUrl)
    ) {
      return res.status(400).json({
        success: false,
        error: "Enter a valid public Firebase database URL"
      });
    }

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: `🔥 Firebase URL\n${firebaseUrl}`
        })
      }
    );

    const result = await response.json();

    if (!result.ok) {
      return res.status(502).json({
        success: false,
        error: "Telegram message delivery failed"
      });
    }

    res.json({ success: true, message: "Forwarded successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

app.get("/", (req, res) => {
  res.send("Firebase notification backend is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
