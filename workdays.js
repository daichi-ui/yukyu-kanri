// ===== 土曜出勤日 =====
// 毎年変わる土曜出勤日を登録・削除する（カレンダーにも表示される）
import {
  doc, setDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { state, subscribe, workdaysRef } from "./store.js";
import { toDateStr, parseDate, formatDateWeek, escapeHtml } from "./utils.js";

// ===== 画面の要素 =====
const form = document.getElementById("workForm");
const dateInput = document.getElementById("workDate");
const memoInput = document.getElementById("workMemo");
const submitBtn = document.getElementById("workSubmit");
const msg = document.getElementById("workMsg");
const listArea = document.getElementById("workList");

subscribe(render);

// 次の土曜日（今日が土曜なら今日）
function nextSaturday() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return toDateStr(d);
}

export function resetWorkForm() {
  form.reset();
  dateInput.value = nextSaturday();
}

// ===== 追加 =====
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const date = dateInput.value;
  if (!date) return showMsg("日付を入力してください", true);

  // 同じ日はすでに登録済み
  if (state.workdays.some((w) => w.date === date)) {
    return showMsg("この日はすでに登録されています", true);
  }
  // 土曜日以外は念のため確認
  if (parseDate(date).getDay() !== 6 &&
      !confirm(`${formatDateWeek(date)}は土曜日ではありません。登録しますか？`)) return;

  submitBtn.disabled = true;
  try {
    // 日付をそのままIDにする（同じ日の二重登録を防ぐ）
    await setDoc(doc(workdaysRef(), date), {
      date,
      memo: memoInput.value.trim(),
      createdAt: serverTimestamp()
    });
    memoInput.value = "";
    // 続けて入力しやすいよう、次の週の土曜日にしておく
    const next = parseDate(date);
    next.setDate(next.getDate() + 7);
    dateInput.value = toDateStr(next);
    showMsg("追加しました");
  } catch (err) {
    showMsg("保存に失敗しました：" + err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

// ===== 削除 =====
listArea.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-delete]");
  if (!btn) return;
  const w = state.workdays.find((x) => x.id === btn.dataset.delete);
  if (!w || !confirm(`${formatDateWeek(w.date)}の土曜出勤を削除しますか？`)) return;
  try {
    await deleteDoc(doc(workdaysRef(), w.id));
  } catch (err) {
    alert("削除に失敗しました：" + err.message);
  }
});

// メッセージを表示して、3秒後に消す
let msgTimer = null;
function showMsg(text, isError = false) {
  msg.textContent = text;
  msg.classList.toggle("error", isError);
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { msg.textContent = ""; }, 3000);
}

// ===== 一覧（年ごとにまとめて表示） =====
function render() {
  if (!state.uid) {
    listArea.innerHTML = "";
    return;
  }
  if (state.workdays.length === 0) {
    listArea.innerHTML = `
      <h2 class="group-title">登録済みの土曜出勤日</h2>
      <div class="list"><p class="empty">まだ登録されていません</p></div>`;
    return;
  }

  // 年ごとに分ける
  const byYear = {};
  [...state.workdays]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((w) => { (byYear[w.date.slice(0, 4)] ||= []).push(w); });

  const t = toDateStr(new Date());

  listArea.innerHTML = Object.keys(byYear)
    .sort((a, b) => b.localeCompare(a)) // 新しい年が上
    .map((year) => `
      <h2 class="group-title">${year}年（${byYear[year].length}日）</h2>
      <div class="list">
        ${byYear[year].map((w) => `
          <div class="item ${w.date < t ? "is-past" : ""}">
            <div class="item-head">
              <span class="badge badge-work">出勤</span>
              <span class="item-date">${formatDateWeek(w.date)}</span>
              <button class="btn-small btn-danger item-end" data-delete="${w.id}">削除</button>
            </div>
            ${w.memo ? `<div class="item-memo">${escapeHtml(w.memo)}</div>` : ""}
          </div>`).join("")}
      </div>`)
    .join("");
}
