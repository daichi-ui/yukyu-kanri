// ===== ホーム =====
//   残日数のリング（外：有給、内：アニバーサリー）と失効までの日数
//   土曜出勤（今年度）を1日1つの点で表示
//   今月の取得・予定
import { state, subscribe } from "./store.js";
import { calculate, leaveDays, kindLabel } from "./calc.js";
import { openLeaveForm, openLeaveEdit } from "./leaves.js";
import { animateNumber } from "./motion.js";
import {
  LEAVE_TYPES, today, parseDate, formatDateWeek, formatDays, escapeHtml
} from "./utils.js";

const summaryEl = document.getElementById("homeSummary");
const monthTitleEl = document.getElementById("homeMonthTitle");
const workEl = document.getElementById("homeWork");
const monthListEl = document.getElementById("homeMonth");

const SOON_DAYS = 90; // 失効まで何日以内なら目立たせるか
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
const RINGS = { paid: 84, anniversary: 60 }; // リングの半径
const slash = (d) => d.replaceAll("-", "/");

subscribe(render);

// 今日から指定日まで何日か
function daysUntil(dateStr, todayStr) {
  return Math.round((parseDate(dateStr) - parseDate(todayStr)) / 86400000);
}

let lastPaid = 0;

function render() {
  if (!state.uid) {
    summaryEl.innerHTML = workEl.innerHTML = monthListEl.innerHTML = "";
    lastPaid = 0;
    return;
  }

  const t = today();
  const { summary, shortageByLeave } = calculate(state.grants, state.leaves, t);
  renderRings(summary, t);
  renderWork(t);
  renderMonth(t, shortageByLeave);
}

// ===== 残日数のリング =====
function ringSvg() {
  const circle = (type, r) => `
    <circle class="ring-track ring-${type}" cx="100" cy="100" r="${r}"/>
    <circle class="ring-bar ring-${type}" data-ring="${type}" cx="100" cy="100" r="${r}"
            stroke-dasharray="${(2 * Math.PI * r).toFixed(2)}" stroke-dashoffset="${(2 * Math.PI * r).toFixed(2)}"/>`;
  return `
    <svg class="rings" viewBox="0 0 200 200" aria-hidden="true">
      <g transform="rotate(-90 100 100)">${circle("paid", RINGS.paid)}${circle("anniversary", RINGS.anniversary)}</g>
    </svg>`;
}

function renderRings(summary, t) {
  // リングとカードの枠は1回だけ作る（描かれる動きを毎回くり返さない）
  if (!summaryEl.firstElementChild) {
    summaryEl.innerHTML = `
      <div class="hero">
        <div class="hero-rings">
          ${ringSvg()}
          <div class="hero-center">
            <span class="hero-center-label">有給の残り</span>
            <span class="hero-num"><span data-count>0</span><small>日</small></span>
          </div>
        </div>
        <div class="hero-legend" data-legend></div>
      </div>`;
  }

  // 今日時点で有効な付与の合計（リングの100%）
  const granted = (type) => state.grants
    .filter((g) => g.type === type && g.grantDate <= t && t <= g.expireDate)
    .reduce((s, g) => s + Number(g.days), 0);

  requestAnimationFrame(() => {
    for (const type of Object.keys(LEAVE_TYPES)) {
      const bar = summaryEl.querySelector(`[data-ring="${type}"]`);
      const total = granted(type);
      const ratio = total ? Math.max(0, Math.min(1, summary[type].remaining / total)) : 0;
      const c = 2 * Math.PI * RINGS[type];
      bar.style.strokeDashoffset = (c * (1 - ratio)).toFixed(2);
    }
  });

  // 小数があるときは文字を少し小さくして、リングの内側に収める
  const countEl = summaryEl.querySelector("[data-count]");
  countEl.parentElement.classList.toggle("is-long", String(Number(summary.paid.remaining.toFixed(3))).length > 3);
  animateNumber(countEl, lastPaid, summary.paid.remaining);
  lastPaid = summary.paid.remaining;

  summaryEl.querySelector("[data-legend]").innerHTML = Object.keys(LEAVE_TYPES).map((type) => {
    const s = summary[type];
    const exp = s.nextExpire;
    const left = exp ? daysUntil(exp.date, t) : null;
    const soon = exp && left <= SOON_DAYS;
    return `
      <div class="legend legend-${type}">
        <span class="legend-dot"></span>
        <span class="legend-name">${LEAVE_TYPES[type].label}</span>
        <span class="legend-num">${Number(s.remaining.toFixed(3))}<small>／${Number(granted(type).toFixed(3))}日</small></span>
        <span class="legend-sub">取得 ${formatDays(s.taken)}${s.planned ? ` ・ 予定 ${formatDays(s.planned)}` : ""}</span>
        ${exp ? `
          <span class="expire ${soon ? "is-soon" : ""}">
            <b>あと${left}日</b>で ${formatDays(exp.days)} 失効
            <small>${slash(exp.date)}</small>
          </span>` : `<span class="expire is-none">失効予定なし</span>`}
      </div>`;
  }).join("");
}

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
  const total = days.length;
  const next = days.find((w) => w.date > t);

  workEl.innerHTML = `
    <div class="work-head">
      <span class="work-label">土曜出勤 <small>${slash(from).slice(0, 7)}〜${slash(to).slice(0, 7)}</small></span>
      <span class="work-count"><b>${done}</b>／${total}日</span>
    </div>
    ${total ? `
      <div class="work-dots" role="img" aria-label="${total}日のうち${done}日消化">
        ${days.map((w, i) => `<span class="work-dot ${w.date <= t ? "is-done" : ""} ${w === next ? "is-next" : ""}" style="--i:${i}" title="${formatDateWeek(w.date)}"></span>`).join("")}
      </div>` : ""}
    <div class="work-foot">
      ${total === 0
        ? "今年度の土曜出勤日はまだありません"
        : next
          ? `次は <b>${formatDateWeek(next.date)}</b>（残り${total - done}日）`
          : "今年度の土曜出勤はすべて終わりました"}
    </div>`;
}

// ===== 今月の取得・予定 =====
function renderMonth(t, shortageByLeave) {
  const month = t.slice(0, 7);
  const items = state.leaves
    .filter((l) => l.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
  const total = items.reduce((sum, l) => sum + leaveDays(l), 0);

  monthTitleEl.innerHTML = `${Number(t.slice(5, 7))}月の休み <span class="section-aside">${formatDays(total)}</span>`;
  monthListEl.innerHTML = items.length
    ? items.map((l) => leaveRow(l, t, shortageByLeave[l.id])).join("")
    : `<p class="empty">今月の休みはまだありません</p>`;
}

// 日付の札つきの1行（カレンダーでも使う）
export function leaveRow(l, t, shortage, { showDate = true } = {}) {
  const d = parseDate(l.date);
  const planned = l.date > t;
  return `
    <button class="leave-row type-${l.type} ${planned ? "is-planned" : ""}" data-id="${l.id}">
      ${showDate ? `
        <span class="date-tag">
          <span class="date-tag-day">${d.getDate()}</span>
          <span class="date-tag-week">${WEEK.at(d.getDay())}</span>
        </span>` : `<span class="type-dot"></span>`}
      <span class="leave-text">
        <span class="leave-title">${LEAVE_TYPES[l.type].short} ・ ${kindLabel(l)}</span>
        <span class="leave-sub">${planned ? "予定" : "取得済み"} ・ ${formatDays(leaveDays(l))}${l.memo ? ` ・ ${escapeHtml(l.memo)}` : ""}</span>
        ${shortage ? `<span class="leave-warn">残日数が ${formatDays(shortage)} 足りません</span>` : ""}
      </span>
      <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
    </button>`;
}

// タップで編集
monthListEl.addEventListener("click", (e) => {
  const item = e.target.closest("[data-id]");
  if (item) openLeaveEdit(item.dataset.id);
});

document.getElementById("homeAddBtn").addEventListener("click", () => openLeaveForm());
