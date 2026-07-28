// ===== 資料載入 =====
let cards = [];
let rules = [];
let quotas = [];

async function loadData() {
  const [cardsRes, rulesRes, quotasRes] = await Promise.all([
    fetch("data/cards.json"),
    fetch("data/rules.json"),
    fetch("data/quotas.json"),
  ]);
  cards = await cardsRes.json();
  rules = await rulesRes.json();
  quotas = await quotasRes.json();

  populateCategories();
  populateMerchants();
  renderQuotas();
  setInterval(renderQuotas, 1000);
}

function populateCategories() {
  const select = document.getElementById("category");
  const categories = [...new Set(rules.map(r => r.category).filter(c => c !== "一般消費"))];
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
  const other = document.createElement("option");
  other.value = "一般消費";
  other.textContent = "其他 / 一般消費";
  select.appendChild(other);
}

function populateMerchants() {
  const list = document.getElementById("merchant-list");
  const merchants = new Set();
  rules.forEach(r => r.merchant.forEach(m => { if (m !== "*") merchants.add(m); }));
  merchants.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    list.appendChild(opt);
  });
}

// ===== 回饋比對邏輯 =====
function getApplicableRule(cardId, category, merchant) {
  const candidates = rules.filter(r => r.card_id === cardId);

  if (merchant) {
    const specific = candidates.find(r =>
      r.merchant.some(m => m !== "*" && m.toLowerCase() === merchant.trim().toLowerCase())
    );
    if (specific) return specific;
  }

  const catMatch = candidates.find(r => r.category === category && r.merchant.includes("*"));
  if (catMatch) return catMatch;

  return candidates.find(r => r.category === "一般消費") || null;
}

function computeResults(category, merchant, amount) {
  const results = cards.map(card => {
    const rule = getApplicableRule(card.id, category, merchant);
    if (!rule) return null;

    let reward = rule.reward_type === "percentage"
      ? amount * (rule.reward_value / 100)
      : rule.reward_value;

    let capped = false;
    if (rule.monthly_cap != null && reward > rule.monthly_cap) {
      reward = rule.monthly_cap;
      capped = true;
    }

    const quota = rule.quota_limited ? quotas.find(q => q.quota_id === rule.quota_id) : null;

    return { card, rule, reward, capped, quota };
  }).filter(Boolean);

  results.sort((a, b) => b.reward - a.reward);
  return results;
}

// ===== 渲染結果 =====
function renderResults(results) {
  const container = document.getElementById("results");
  if (results.length === 0) {
    container.innerHTML = `<p class="results-hint">找不到符合的回饋規則，請確認類別或改用「其他 / 一般消費」。</p>`;
    return;
  }

  const rows = results.map((r, i) => {
    const isWinner = i === 0;
    const quotaLine = r.quota
      ? `<div class="quota-flag">限量登記制 · 開搶時間見下方名額提醒</div>`
      : "";
    const capLine = r.capped
      ? `<div class="card-condition">已達每月回饋上限</div>`
      : "";
    const condLine = r.rule.conditions
      ? `<div class="card-condition">${escapeHtml(r.rule.conditions)}</div>`
      : "";

    return `
      <div class="credit-card ${isWinner ? "is-winner" : ""}">
        ${isWinner ? `<span class="ribbon">最佳回饋</span>` : ""}
        <div class="card-chip"></div>
        <div class="card-body">
          <div class="card-name">${escapeHtml(r.card.name)}</div>
          <div class="card-last4">•••• ${r.card.last4}</div>
          ${condLine}
          ${capLine}
          ${quotaLine}
        </div>
        <div class="card-reward">
          <div class="amount">NT$ ${Math.round(r.reward).toLocaleString()}</div>
          <div class="rate">${r.rule.reward_type === "percentage" ? r.rule.reward_value + "% 回饋" : "固定回饋"}</div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `<div class="card-row">${rows}</div>`;
}

// ===== 名額倒數 =====
function renderQuotas() {
  const container = document.getElementById("quota-list");
  if (!container || quotas.length === 0) return;

  const now = new Date();
  const sorted = [...quotas].sort((a, b) => new Date(a.register_open) - new Date(b.register_open));

  container.innerHTML = sorted.map(q => {
    const target = new Date(q.register_open);
    const diff = target - now;
    const isPast = diff <= 0;
    const countdown = isPast ? "已開放" : formatCountdown(diff);

    return `
      <div class="quota-item">
        <div>
          <div class="quota-desc">${escapeHtml(q.description)}</div>
          <div class="quota-note">${escapeHtml(q.register_note)}</div>
        </div>
        <div class="quota-countdown ${isPast ? "past" : ""}">
          <div class="time">${countdown}</div>
          <div class="label">${formatDateTime(target)}</div>
        </div>
      </div>
    `;
  }).join("");
}

function formatCountdown(ms) {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) return `${days}天 ${hours}時後`;
  if (hours > 0) return `${hours}時 ${mins}分後`;
  if (mins > 0) return `${mins}分 ${secs}秒後`;
  return `${secs}秒後`;
}

function formatDateTime(d) {
  return d.toLocaleString("zh-TW", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ===== 事件綁定 =====
document.getElementById("calc-btn").addEventListener("click", () => {
  const category = document.getElementById("category").value || "一般消費";
  const merchant = document.getElementById("merchant").value.trim();
  const amount = parseFloat(document.getElementById("amount").value) || 0;

  if (amount <= 0) {
    document.getElementById("results").innerHTML =
      `<p class="results-hint">請輸入大於 0 的消費金額。</p>`;
    return;
  }

  const results = computeResults(category, merchant, amount);
  renderResults(results);
});

loadData();
