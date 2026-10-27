// ===== ホーム =====
// 残日数・失効日・今月の取得と予定を表示する
import { state, subscribe } from "./store.js";
import { calculate, leaveDays, kindLabel } from "./calc.js";
import { openLeaveForm, openLeaveEdit } from "./leaves.js";
import {
  LEAVE_TYPES, today, parseDate, formatDate, formatDateWeek, formatDays, escapeHtml
} from "./utils.js";

const summaryEl = document.getElementById("homeSummary");
const monthTitleEl = document.getElementById("homeMonthTitle");
const monthListEl = document.getElementById("homeMonth");

const SOON_DAYS = 90; // 失効まで何日以内なら赤く表示するか

subscribe(render);

// 今日から指定日まで何日か
function daysUntil(dateStr, todayStr) {
  return Math.round((parseDate(dateStr) - parseDate(todayStr)) / 86400000);
}

function render() {
  if (!state.uid) {
    summaryEl.innerHTML = "";
    monthListEl.innerHTML = "";
    return;
  }

  const t = today();
  const { summary, shortageByLeave } = calculate(state.grants, state.leaves, t);

  // ===== 残日数と失効日 =====
  summaryEl.innerHTML = Object.keys(LEAVE_TYPES).map((type) => {
    const s = summary[type];
    const exp = s.nextExpire;
    const soon = exp && daysUntil(exp.date, t) <= SOON_DAYS;

    return `
      <div class="summary-card summary-${type}">
        <div class="summary-label">${LEAVE_TYPES[type].label}</div>
        <div class="summary-main">
          <span class="summary-num">${Number(s.remaining.toFixed(3))}</span>
          <span class="summary-unit">日</span>
        </div>
        <div class="summary-expire ${soon ? "is-soon" : ""}">
          ${exp
            ? `失効日：${formatDate(exp.date)}（${formatDays(exp.days)}）`
            : "失効予定はありません"}
        </div>
      </div>`;
  }).join("");

  // ===== 今月の取得・予定 =====
  const month = t.slice(0, 7); // "2026-10"
  const m = Number(t.slice(5, 7));
  const items = state.leaves
    .filter((l) => l.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
  const total = items.reduce((sum, l) => sum + leaveDays(l), 0);

  monthTitleEl.textContent = `${m}月の取得・予定（${formatDays(total)}）`;

  monthListEl.innerHTML = items.length
    ? items.map((l) => {
        const shortage = shortageByLeave[l.id];
        return `
          <button class="item item-button" data-id="${l.id}">
            <div class="item-head">
              <span class="item-date">${formatDateWeek(l.date)}</span>
              <span class="item-status">${l.date > t ? "予定" : "取得済み"}</span>
            </div>
            <div class="item-sub">
              <span class="badge badge-${l.type}">${LEAVE_TYPES[l.type].short}</span>
              ${kindLabel(l)}（${formatDays(leaveDays(l))}）
            </div>
            ${l.memo ? `<div class="item-memo">${escapeHtml(l.memo)}</div>` : ""}
            ${shortage ? `<div class="item-warn">残日数が ${formatDays(shortage)} 足りません</div>` : ""}
          </button>`;
      }).join("")
    : `<p class="empty">今月の取得・予定はありません</p>`;
}

// タップで編集
monthListEl.addEventListener("click", (e) => {
  const item = e.target.closest("[data-id]");
  if (item) openLeaveEdit(item.dataset.id);
});

document.getElementById("homeAddBtn").addEventListener("click", () => openLeaveForm());
