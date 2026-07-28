# 回饋雷達 · 信用卡回饋比較系統

輸入消費類別、商店、金額，立即比較所有信用卡的回饋金額，並提醒限量名額的開搶時間。
完全建構在 GitHub 上：GitHub Pages 當前端網站，GitHub Actions 當提醒排程，不需要任何伺服器。

## 快速開始（3 步驟）

### 1. 建立 Repo
把這整個資料夾內容 commit 到你的 GitHub Repo（保留原本的資料夾結構）。

```
credit-card-rewards/
├── docs/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── data/
│       ├── cards.json
│       ├── rules.json
│       ├── quotas.json
│       └── notified.json
├── scripts/
│   └── check_quota.js
├── .github/workflows/remind.yml
└── README.md
```

### 2. 開啟 GitHub Pages
Repo → **Settings → Pages** → Source 選 `Deploy from a branch` → Branch 選 `main`，資料夾選 **`/docs`** → Save。
幾分鐘後即可用 `https://你的帳號.github.io/credit-card-rewards/` 開啟網站。

### 3.（選用）設定限量名額提醒通知
如果要收到「開搶前 24 小時 / 1 小時」的手機通知，到 Repo → **Settings → Secrets and variables → Actions** 新增以下任一組：

| Secret 名稱 | 說明 |
|---|---|
| `DISCORD_WEBHOOK_URL` | Discord 頻道設定 → 整合 → Webhook → 複製網址 |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | 用 [@BotFather](https://t.me/BotFather) 建立 Bot 取得 token，聊天室 ID 可用 `@userinfobot` 取得 |

不設定也沒關係，網站本身的倒數提醒一樣會正常顯示，只是不會主動推播到手機。

> 提醒：LINE Notify 官方服務已於 2025 年 3 月底停止，因此本專案改用 Discord / Telegram 作為推播管道。

## 日常維護：更新回饋規則

信用卡回饋規則會變動，只要編輯以下三個檔案並 commit，網站會自動套用最新資料（無需重新部署）：

- `docs/data/cards.json` — 信用卡清單
- `docs/data/rules.json` — 各卡片對應類別/商店的回饋規則
- `docs/data/quotas.json` — 限量名額的開放登記時間

### `rules.json` 欄位說明

| 欄位 | 說明 |
|---|---|
| `card_id` | 對應 `cards.json` 的卡片 id |
| `category` | 消費類別，例如「超商」「餐飲」「網購」「一般消費」（保底規則） |
| `merchant` | 適用商店陣列，`["*"]` 代表該類別下所有商店皆適用 |
| `reward_type` | `percentage`（百分比）或 `fixed`（固定金額） |
| `reward_value` | 回饋數值 |
| `monthly_cap` | 每月回饋上限，無上限填 `null` |
| `conditions` | 額外條件文字說明，例如需綁定行動支付 |
| `quota_limited` | 是否為限量登記制 |
| `quota_id` | 對應 `quotas.json` 的名額 id（`quota_limited` 為 `true` 時才需要） |

## 本機測試提醒腳本

```bash
cd scripts
DISCORD_WEBHOOK_URL="你的webhook" node check_quota.js
```

## 系統限制

- 銀行沒有公開 API，回饋規則需要自行手動維護更新
- 比對邏輯以「精確商店名稱優先，其次類別，最後保底一般消費回饋」為原則，複雜的疊加/加碼活動需自行擴充 `rules.json` 的結構
- Actions 排程為每小時檢查一次，並非即時秒級推播
