const express = require("express");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID;
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
const FIREBASE_PATH = process.env.FIREBASE_PATH || "appNotifications";
const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

let db = null;
let firebaseStatus = "disconnected";
let telegramStatus = "disconnected";

async function sendTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error("Telegram environment variables are missing");
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
        text: text
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.description || "Telegram send failed");
  }

  telegramStatus = "connected";
  return result;
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Firebase Telegram Forwarder",
    firebase: firebaseStatus,
    telegram: telegramStatus
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    firebaseConfigured: Boolean(db),
    telegramConfigured: Boolean(BOT_TOKEN && CHAT_ID),
    firebaseStatus,
    telegramStatus,
    port: PORT
  });
});

app.get("/api/telegram/test", async (req, res) => {
  try {
    await sendTelegram("✅ Telegram connection test successful.");
    res.json({
      ok: true,
      message: "Telegram test message sent"
    });
  } catch (error) {
    console.error("Telegram test failed:", error.message);
    res.status(500).json({
      ok: false,
      error: "Telegram message failed"
    });
  }
});

async function startFirebaseListener() {
  if (!DATABASE_URL || !SERVICE_ACCOUNT) {
    console.log("Firebase credentials are not configured.");
    return;
  }

  const serviceAccount = JSON.parse(SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DATABASE_URL
  });

  db = admin.database();

  const ref = db.ref(FIREBASE_PATH);
  const knownIds = new Set();
  const queuedEvents = [];

  let ready = false;

  async function processEvent(snapshot) {
    if (!snapshot.key || knownIds.has(snapshot.key)) return;

    knownIds.add(snapshot.key);

    const data = snapshot.val();

    if (!data || typeof data !== "object") return;

    // Forward only approved, non-sensitive event metadata.
    const eventType = String(data.eventType || "application_event")
      .slice(0, 80);

    const status = String(data.status || "updated")
      .slice(0, 80);

    const timestamp = String(data.timestamp || "")
      .slice(0, 80);

    const message = [
      "🔔 New Firebase application event",
      `Type: ${eventType}`,
      `Status: ${status}`,
      timestamp ? `Timestamp: ${timestamp}` : ""
    ].filter(Boolean).join("\n");

    try {
      await sendTelegram(message);
      console.log("Application event forwarded:", snapshot.key);
    } catch (error) {
      console.error("Forward failed:", error.message);
    }
  }

  ref.on(
    "child_added",
    (snapshot) => {
      if (!ready) {
        queuedEvents.push(snapshot);
        return;
      }

      processEvent(snapshot).catch((error) => {
        console.error("Event processing error:", error.message);
      });
    },
    (error) => {
      firebaseStatus = "error";
      console.error("Firebase listener error:", error.message);
    }
  );

  try {
    // Mark existing records so they are not forwarded on startup.
    const initial = await ref.once("value");

    initial.forEach((child) => {
      knownIds.add(child.key);
    });

    ready = true;
    firebaseStatus = "connected";

    // Process only events that arrived during initialization.
    for (const snapshot of queuedEvents) {
      if (!knownIds.has(snapshot.key)) {
        await processEvent(snapshot);
      }
    }

    console.log("Firebase listener connected:", FIREBASE_PATH);
  } catch (error) {
    firebaseStatus = "error";
    console.error("Firebase initialization failed:", error.message);
  }
}

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server listening on port ${PORT}`);

  try {
    await startFirebaseListener();
  } catch (error) {
    console.error("Startup error:", error.message);
  }
});
