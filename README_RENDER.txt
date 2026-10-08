BROTHERS PANEL - RENDER WEB SERVICE

Files:
- index.html
- server.js
- package.json

Render:
- Runtime: Node
- Root Directory: leave blank
- Build Command: npm install
- Start Command: npm start

Environment Variables:
- TELEGRAM_BOT_TOKEN = your Telegram bot token
- TELEGRAM_CHANNEL_ID = your channel ID

The browser sends only the Firebase URL and connection time to the backend.
The Firebase authentication key/secret is NOT sent to Telegram.
The Telegram bot token stays server-side in Render environment variables.

Endpoint:
POST /api/telegram/firebase-connected
GET /health
