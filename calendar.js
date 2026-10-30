// ===== カレンダー =====
import { state, subscribe } from "./store.js";
import { leaveDays, kindLabel } from "./calc.js";
import { openLeaveForm, openLeaveEdit } from "./leaves.js";
import {
  LEAVE_TYPES, today, toDateStr, parseDate, formatDateWeek, formatDays, escapeHtml
} from "./utils.js";

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
  render();
}

document.getElementById("calPrev").addEventListener("click", () => moveMonth(-1));
document.getElementById("calNext").addEventListener("click", () => moveMonth(1));
document.getElementById("calToday").addEventListener("click", () => {
  const d = new Date();
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
});

// 詳細の予定をタップ → 編集
detailEl.addEventListener("click", (e) => {
  const item = e.target.closest("[data-id]");
  if (item) openLeaveEdit(item.dataset.id);
});

// この日に登録
document.getElementById("calAddBtn").addEventListener("click", () => openLeaveForm(selected));

// ===== 表示 =====

// カレンダーのマス内に出す短い表示
function shortKind(l) {
  if (l.kind === "am") return "AM";
  if (l.kind === "pm") return "PM";
  if (l.kind === "hour") return `${l.hours}h`;
  return "休";
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

    const marks = [
      ...(work ? [`<span class="cal-chip chip-work">出勤</span>`] : []),
      ...leaves.map((l) =>
        `<span class="cal-chip chip-${l.type} ${l.date > t ? "is-planned" : ""}">${shortKind(l)}</span>`),
      ...grants.map((g) => `<span class="cal-chip chip-grant">付与</span>`)
    ].join("");

    cells.push(`
      <button class="${classes}" data-date="${date}">
        <span class="cal-num">${d}</span>
        <span class="cal-marks">${marks}</span>
      </button>`);
  }

  while (cells.length % 7 !== 0) {
    cells.push(`<div class="cal-day is-blank"></div>`);
  }

  gridEl.innerHTML = cells.join("");
  monthTotalEl.textContent = `この月：${formatDays(monthTotal)}`;

  renderDetail(leavesByDate[selected] || [], grantsByDate[selected] || [], workByDate[selected], t);
}

// 選んだ日の内容
function renderDetail(leaves, grants, work, t) {
  detailTitleEl.textContent = formatDateWeek(selected);

  const leaveHtml = leaves.map((l) => `
    <button class="item item-button" data-id="${l.id}">
      <div class="item-head">
        <span class="badge badge-${l.type}">${LEAVE_TYPES[l.type].short}</span>
        <span class="item-date">${kindLabel(l)}</span>
        <span class="item-status">${l.date > t ? "予定" : "取得済み"}・${formatDays(leaveDays(l))}</span>
      </div>
      ${l.memo ? `<div class="item-memo">${escapeHtml(l.memo)}</div>` : ""}
    </button>`).join("");

  const grantHtml = grants.map((g) => `
    <div class="item">
      <div class="item-head">
        <span class="badge badge-${g.type}">${LEAVE_TYPES[g.type].short}</span>
        <span class="item-date">${formatDays(g.days)} 付与</span>
      </div>
    </div>`).join("");

  const workHtml = work ? `
    <div class="item">
      <div class="item-head">
        <span class="badge badge-work">出勤</span>
        <span class="item-date">土曜出勤日</span>
      </div>
      ${work.memo ? `<div class="item-memo">${escapeHtml(work.memo)}</div>` : ""}
    </div>` : "";

  detailEl.innerHTML = workHtml + leaveHtml + grantHtml || `<p class="empty">登録はありません</p>`;
}

// 他の画面から特定の日付を開く用
export function showCalendarDate(date) {
  const d = parseDate(date);
  year = d.getFullYear();
  month = d.getMonth();
  selected = date;
  render();
}
