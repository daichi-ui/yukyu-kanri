// ===== ホーム（残日数の表示） =====
import { state, subscribe } from "./store.js";
import { calculate, leaveDays, kindLabel } from "./calc.js";
import { openLeaveForm, openLeaveEdit } from "./leaves.js";
import {
  LEAVE_TYPES, today, parseDate, formatDate, formatDateWeek, formatDays, escapeHtml
} from "./utils.js";

const summaryEl = document.getElementById("homeSummary");
const upcomingEl = document.getElementById("homeUpcoming");

const SOON_DAYS = 90;     // 期限まで何日以内なら注意表示にするか
const UPCOMING_COUNT = 3; // 直近の予定を何件出すか

subscribe(render);

// 今日から指定日まで何日か
function daysUntil(dateStr, todayStr) {
  return Math.round((parseDate(dateStr) - parseDate(todayStr)) / 86400000);
}

function render() {
  if (!state.uid) {
    summaryEl.innerHTML = "";
    upcomingEl.innerHTML = "";
    return;
  }

  const t = today();
  const { summary } = calculate(state.grants, state.leaves, t);

  // ===== 残日数カード =====
  summaryEl.innerHTML = Object.keys(LEAVE_TYPES).map((type) => {
    const s = summary[type];
    const exp = s.nextExpire;
    const left = exp ? daysUntil(exp.date, t) : null;
    const soon = exp && left <= SOON_DAYS;

    return `
      <div class="summary-card summary-${type}">
        <div class="summary-label">${LEAVE_TYPES[type].label}</div>
        <div class="summary-main">
          <span class="summary-num">${Number(s.remaining.toFixed(3))}</span>
          <span class="summary-unit">日</span>
        </div>
        <div class="summary-detail">
          取得済み ${formatDays(s.taken)} ・ 予定 ${formatDays(s.planned)}
          ${s.planned > 0 ? `<br><span class="summary-note">※予定分は差し引き済み</span>` : ""}
        </div>
        ${exp ? `
          <div class="summary-expire ${soon ? "is-soon" : ""}">
            ${formatDate(exp.date)}に ${formatDays(exp.days)} 失効
            ${soon ? `（あと${left}日）` : ""}
          </div>` : ""}
      </div>`;
  }).join("");

  // ===== 直近の予定 =====
  const upcoming = state.leaves
    .filter((l) => l.date > t)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, UPCOMING_COUNT);

  upcomingEl.innerHTML = upcoming.length
    ? upcoming.map((l) => `
        <button class="item item-button" data-id="${l.id}">
          <div class="item-head">
            <span class="item-date">${formatDateWeek(l.date)}</span>
            <span class="item-status">あと${daysUntil(l.date, t)}日</span>
          </div>
          <div class="item-sub">
            <span class="badge badge-${l.type}">${LEAVE_TYPES[l.type].short}</span>
            ${kindLabel(l)}（${formatDays(leaveDays(l))}）
          </div>
          ${l.memo ? `<div class="item-memo">${escapeHtml(l.memo)}</div>` : ""}
        </button>`).join("")
    : `<p class="empty">予定はありません</p>`;
}

upcomingEl.addEventListener("click", (e) => {
  const item = e.target.closest("[data-id]");
  if (item) openLeaveEdit(item.dataset.id);
});

document.getElementById("homeAddBtn").addEventListener("click", () => openLeaveForm());
