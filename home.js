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
const workEl = document.getElementById("homeWork");
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
    workEl.innerHTML = "";
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

  renderWork(t);

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

// ===== 今年度の土曜出勤日 =====
// 年度は 4月1日〜翌年3月31日（例：2026年10月なら 2026/04/01〜2027/03/31）
function fiscalYear(todayStr) {
  const y = Number(todayStr.slice(0, 4));
  const m = Number(todayStr.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

function renderWork(t) {
  const { from, to } = fiscalYear(t);
  const days = state.workdays
    .filter((w) => from <= w.date && w.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
  const done = days.filter((w) => w.date <= t).length; // 消化した日（今日を含む）
  const total = days.length;                            // 登録済みの日（未来も含む）
  const next = days.find((w) => w.date > t);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const slash = (d) => d.replaceAll("-", "/");

  workEl.innerHTML = `
    <div class="work-head">
      <span class="summary-label work-label">土曜出勤（今年度）</span>
      <span class="work-period">${slash(from)}〜${slash(to)}</span>
    </div>
    <div class="work-main">
      <span class="summary-num work-num">${done}</span>
      <span class="work-total">／ ${total}日</span>
      <span class="work-sub">消化済み</span>
    </div>
    <div class="work-bar" role="progressbar" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${total}">
      <span style="width:${percent}%"></span>
    </div>
    <div class="summary-expire">
      ${total === 0
        ? "今年度の土曜出勤日はまだ登録されていません"
        : next
          ? `次の出勤日：${formatDateWeek(next.date)}（残り${total - done}日）`
          : "今年度の土曜出勤はすべて消化しました"}
    </div>`;
}
