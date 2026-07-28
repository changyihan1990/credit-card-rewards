// 檢查限量名額開放時間，並在開放前 24 小時 / 1 小時各發送一次提醒。
// 已提醒過的項目會記錄在 docs/data/notified.json，避免每小時重複發通知。
//
// 需要的環境變數（擇一或兩者皆設定）：
//   DISCORD_WEBHOOK_URL   Discord 頻道的 Webhook URL
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID   Telegram Bot 的 token 與聊天室 ID
//
// 註：LINE Notify 官方服務已於 2025 年 3 月底停止，故本腳本改用 Discord / Telegram。

const fs = require("fs");
const path = require("path");

const QUOTAS_PATH = path.join(__dirname, "..", "docs", "data", "quotas.json");
const NOTIFIED_PATH = path.join(__dirname, "..", "docs", "data", "notified.json");

const REMINDER_WINDOWS = [
  { key: "24h", ms: 24 * 60 * 60 * 1000, label: "24 小時" },
  { key: "1h", ms: 1 * 60 * 60 * 1000, label: "1 小時" },
];

function loadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    return fallback;
  }
}

async function sendDiscord(message) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });
}

async function sendTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
}

async function notify(message) {
  console.log(message);
  await Promise.all([sendDiscord(message), sendTelegram(message)]);
}

async function main() {
  const quotas = loadJson(QUOTAS_PATH, []);
  const notified = loadJson(NOTIFIED_PATH, {});
  const now = new Date();
  let changed = false;

  for (const q of quotas) {
    const target = new Date(q.register_open);
    const diff = target - now;
    if (diff <= 0) continue; // 已開放，不再提醒

    notified[q.quota_id] = notified[q.quota_id] || [];

    for (const win of REMINDER_WINDOWS) {
      const alreadySent = notified[q.quota_id].includes(win.key);
      // diff 落在該提醒窗口之內（例如 <=24h 且尚未到 1h 窗口）就發送一次
      const withinWindow = diff <= win.ms;

      if (withinWindow && !alreadySent) {
        const openTime = target.toLocaleString("zh-TW", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit",
        });
        await notify(
          `⏰ 【${win.label}前提醒】${q.description}\n` +
          `開放登記時間：${openTime}\n` +
          `注意事項：${q.register_note}`
        );
        notified[q.quota_id].push(win.key);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(NOTIFIED_PATH, JSON.stringify(notified, null, 2));
    console.log("已更新 notified.json");
  } else {
    console.log("本次檢查沒有需要發送的提醒。");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
