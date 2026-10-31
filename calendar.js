// ===== カレンダー =====
import { state, subscribe } from "./store.js";
import { leaveDays, calculate } from "./calc.js";
import { leaveRow } from "./home.js";
import { openLeaveForm, openLeaveEdit } from "./leaves.js";
import {
  LEAVE_TYPES, today, toDateStr, parseDate, formatDateWeek, formatDays, escapeHtml
} from "./utils.js";

let slideDir = 0; // 月を変えた向き（すべり込みの動きに使う）

// ===== 画面の要素 =====
const titleEl = document.getElementById("calTitle");
const gridEl = document.getElementById("calGrid");
const monthTotalEl = document.getElementById("calMonthTotal");
const detailTitleEl = document.getElementById("calDetailTitle");
const detailEl = document.getElementById("calDetail");

// ===== 状態 =====
const now = new Date();
let year = now.getFullYear();
let month = now.getMonth(); // 0 = 1月
let selected = today();     // 選んでいる日付

subscribe(render);

// ===== 月の移動 =====
function moveMonth(diff) {
  const d = new Date(year, month + diff, 1);
  year = d.getFullYear();
  month = d.getMonth();
  slideDir = diff;
  render();
}

// 左右のスワイプで月を移動
let x0 = null;
gridEl.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
gridEl.addEventListener("touchend", (e) => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0;
  x0 = null;
  if (Math.abs(dx) > 50) moveMonth(dx < 0 ? 1 : -1);
}, { passive: true });

document.getElementById("calPrev").addEventListener("click", () => moveMonth(-1));
document.getElementById("calNext").addEventListener("click", () => moveMonth(1));
document.getElementById("calToday").addEventListener("click", () => {
  const d = new Date();
  slideDir = (d.getFullYear() * 12 + d.getMonth()) - (year * 12 + month);
  year = d.getFullYear();
  month = d.getMonth();
  selected = today();
  render();
});

// 日付をタップ → 選択
gridEl.addEventListener("click", (e) => {
  const cell = e.target.closest("[data-date]");
  if (!cell) return;
  selected = cell.dataset.date;
  render();
  // タップしたマスに波紋
  gridEl.querySelector(`[data-date="${selected}"]`)?.classList.add("is-tapped");
});

// 詳細の予定をタップ → 編集
detailEl.addEventListener("click", (e) => {
  const item = e.target.closest("[data-id]");
  if (item) openLeaveEdit(item.dataset.id);
});

// この日に登録
document.getElementById("calAddBtn").addEventListener("click", () => openLeaveForm(selected));

// ===== 表示 =====

// マスの中の印：休みは色の丸（半休は半分、時間休は小さな丸）、予定は点線
function leaveMark(l, t) {
  const shape = l.kind === "am" ? "is-am" : l.kind === "pm" ? "is-pm" : l.kind === "hour" ? "is-hour" : "";
  return `<span class="mark mark-${l.type} ${shape} ${l.date > t ? "is-planned" : ""}"></span>`;
}

function render() {
  if (!state.uid) {
    gridEl.innerHTML = "";
    detailEl.innerHTML = "";
    return;
  }

  const t = today();
  titleEl.textContent = `${year}年${month + 1}月`;

  // 日付ごとにまとめる
  const leavesByDate = {};
  state.leaves.forEach((l) => {
    (leavesByDate[l.date] ||= []).push(l);
  });
  const grantsByDate = {};
  state.grants.forEach((g) => {
    (grantsByDate[g.grantDate] ||= []).push(g);
  });
  const workByDate = {};
  state.workdays.forEach((w) => { workByDate[w.date] = w; });

  // マスを作る（前月の空白 → 当月の日付 → 後ろの空白）
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startOffset; i++) {
    cells.push(`<div class="cal-day is-blank"></div>`);
  }

  let monthTotal = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = toDateStr(new Date(year, month, d));
    const dow = (startOffset + d - 1) % 7;
    const leaves = leavesByDate[date] || [];
    const grants = grantsByDate[date] || [];
    const work = workByDate[date];
    leaves.forEach((l) => { monthTotal += leaveDays(l); });

    const classes = [
      "cal-day",
      dow === 0 ? "is-sun" : "",
      dow === 6 ? "is-sat" : "",
      work ? "is-work" : "",
      date === t ? "is-today" : "",
      date === selected ? "is-selected" : ""
    ].join(" ");

    const marks = leaves.map((l) => leaveMark(l, t)).join("");
    const label = [
      formatDateWeek(date),
      work ? "土曜出勤" : "",
      ...leaves.map((l) => `${LEAVE_TYPES[l.type].short}${l.date > t ? "の予定" : ""}`),
      grants.length ? "付与日" : ""
    ].filter(Boolean).join("、");

    cells.push(`
      <button class="${classes}" data-date="${date}" aria-label="${label}" aria-pressed="${date === selected}">
        <span class="cal-num">${d}</span>
        ${grants.length ? `<span class="grant-star" aria-hidden="true">★</span>` : ""}
        <span class="cal-marks">${marks}</span>
      </button>`);
  }

  while (cells.length % 7 !== 0) {
    cells.push(`<div class="cal-day is-blank"></div>`);
  }

  gridEl.innerHTML = cells.join("");
  // 月を変えたときは、進んだ向きからすべり込ませる
  gridEl.classList.remove("slide-next", "slide-prev");
  if (slideDir) {
    void gridEl.offsetWidth;
    gridEl.classList.add(slideDir > 0 ? "slide-next" : "slide-prev");
    slideDir = 0;
  }
  monthTotalEl.textContent = `この月 ${formatDays(monthTotal)}`;

  renderDetail(leavesByDate[selected] || [], grantsByDate[selected] || [], workByDate[selected], t);
}

// 選んだ日の内容
function renderDetail(leaves, grants, work, t) {
  detailTitleEl.textContent = formatDateWeek(selected);
  const { shortageByLeave } = calculate(state.grants, state.leaves, t);

  const leaveHtml = leaves.map((l) => leaveRow(l, t, shortageByLeave[l.id], { showDate: false })).join("");

  const grantHtml = grants.map((g) => `
    <div class="info-row type-${g.type}">
      <span class="info-icon">★</span>
      <span class="leave-text">
        <span class="leave-title">${LEAVE_TYPES[g.type].label}が ${formatDays(g.days)} 付与</span>
        <span class="leave-sub">${g.expireDate.replaceAll("-", "/")} まで有効</span>
      </span>
    </div>`).join("");

  const workHtml = work ? `
    <div class="info-row type-work">
      <span class="info-icon"><svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></span>
      <span class="leave-text">
        <span class="leave-title">土曜出勤</span>
        ${work.memo ? `<span class="leave-sub">${escapeHtml(work.memo)}</span>` : ""}
      </span>
    </div>` : "";

  detailEl.innerHTML = workHtml + leaveHtml + grantHtml || `<p class="empty">この日の登録はありません</p>`;
  detailEl.classList.remove("pop");
  void detailEl.offsetWidth;
  detailEl.classList.add("pop");
}

// 他の画面から特定の日付を開く用
export function showCalendarDate(date) {
  const d = parseDate(date);
  year = d.getFullYear();
  month = d.getMonth();
  selected = date;
  render();
}
