// ===== 取得・予定の登録と履歴一覧 =====
import {
  doc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { state, subscribe, leavesRef } from "./store.js";
import { calculate, leaveDays, kindLabel } from "./calc.js";
import { LEAVE_TYPES, today, formatDateWeek, formatDays, escapeHtml } from "./utils.js";

// ===== 画面の要素 =====
const dialog = document.getElementById("leaveDialog");
const form = document.getElementById("leaveForm");
const formTitle = document.getElementById("leaveFormTitle");
const dateInput = document.getElementById("leaveDate");
const typeInput = document.getElementById("leaveType");
const kindInput = document.getElementById("leaveKind");
const hoursField = document.getElementById("leaveHoursField");
const hoursInput = document.getElementById("leaveHours");
const memoInput = document.getElementById("leaveMemo");
const submitBtn = document.getElementById("leaveSubmit");
const deleteBtn = document.getElementById("leaveDelete");
const msg = document.getElementById("leaveMsg");
const plannedList = document.getElementById("plannedList");
const takenList = document.getElementById("takenList");

let editingId = null; // 編集中のデータID（新規登録なら null）

// データが変わったら一覧を描き直す
subscribe(render);

// ===== 入力画面（ダイアログ） =====

// 新規登録で開く（カレンダーからは日付を指定して開く）
export function openLeaveForm(date = today()) {
  editingId = null;
  form.reset();
  dateInput.value = date;
  formTitle.textContent = "取得・予定を登録";
  submitBtn.textContent = "登録する";
  deleteBtn.hidden = true;
  updateKindFields();
  msg.textContent = "";
  dialog.showModal();
}

// 編集で開く
export function openLeaveEdit(id) {
  const l = state.leaves.find((x) => x.id === id);
  if (!l) return;
  editingId = id;
  dateInput.value = l.date;
  typeInput.value = l.type;
  kindInput.value = l.kind;
  hoursInput.value = l.hours ?? 1;
  memoInput.value = l.memo || "";
  formTitle.textContent = "取得・予定を編集";
  submitBtn.textContent = "更新する";
  deleteBtn.hidden = false;
  updateKindFields();
  msg.textContent = "";
  dialog.showModal();
}

// 種別・取得種類に合わせて入力欄を切り替え
// アニバーサリー休暇は全休のみ、時間休のときだけ時間数を表示
function updateKindFields() {
  const isAnniversary = typeInput.value === "anniversary";
  if (isAnniversary) kindInput.value = "full";
  kindInput.disabled = isAnniversary;
  hoursField.hidden = kindInput.value !== "hour";
}

typeInput.addEventListener("change", updateKindFields);
kindInput.addEventListener("change", updateKindFields);
document.getElementById("leaveCancel").addEventListener("click", () => dialog.close());

// 背景をタップしたら閉じる
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});

// 登録・更新
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";

  const data = {
    date: dateInput.value,
    type: typeInput.value,
    kind: kindInput.value,
    hours: kindInput.value === "hour" ? Number(hoursInput.value) : null,
    memo: memoInput.value.trim()
  };

  if (!data.date) return showMsg("日付を入力してください", true);

  // 同じ日にすでに登録があれば確認する
  const sameDay = state.leaves.filter((l) => l.date === data.date && l.id !== editingId);
  if (sameDay.length > 0 && !confirm("この日にはすでに登録があります。登録しますか？")) return;

  // 残日数が足りるか確認する（登録した場合を仮に計算）
  const tempId = editingId ?? "__new__";
  const others = state.leaves.filter((l) => l.id !== editingId);
  const { shortageByLeave } = calculate(state.grants, [...others, { ...data, id: tempId }], today());
  const shortage = shortageByLeave[tempId];
  if (shortage && !confirm(`残日数が ${formatDays(shortage)} 足りません。登録しますか？`)) return;

  submitBtn.disabled = true;
  try {
    if (editingId) {
      await updateDoc(doc(leavesRef(), editingId), data);
    } else {
      await addDoc(leavesRef(), { ...data, createdAt: serverTimestamp() });
    }
    dialog.close();
  } catch (err) {
    showMsg("保存に失敗しました：" + err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

// 削除
deleteBtn.addEventListener("click", async () => {
  if (!editingId) return;
  if (!confirm("この登録を削除しますか？")) return;
  try {
    await deleteDoc(doc(leavesRef(), editingId));
    dialog.close();
  } catch (err) {
    showMsg("削除に失敗しました：" + err.message, true);
  }
});

function showMsg(text, isError = false) {
  msg.textContent = text;
  msg.classList.toggle("error", isError);
}

// ===== 履歴一覧の表示 =====
function render() {
  if (!state.uid) {
    plannedList.innerHTML = "";
    takenList.innerHTML = "";
    return;
  }

  const t = today();
  const { shortageByLeave } = calculate(state.grants, state.leaves, t);

  // 予定：近い順、取得済み：新しい順
  const planned = state.leaves
    .filter((l) => l.date > t)
    .sort((a, b) => a.date.localeCompare(b.date));
  const taken = state.leaves
    .filter((l) => l.date <= t)
    .sort((a, b) => b.date.localeCompare(a.date));

  plannedList.innerHTML = planned.length
    ? planned.map((l) => itemHtml(l, shortageByLeave[l.id])).join("")
    : `<p class="empty">予定はありません</p>`;

  takenList.innerHTML = taken.length
    ? taken.map((l) => itemHtml(l, shortageByLeave[l.id])).join("")
    : `<p class="empty">まだ取得の記録がありません</p>`;
}

function itemHtml(l, shortage) {
  return `
    <button class="item item-button" data-id="${l.id}">
      <div class="item-head">
        <span class="item-date">${formatDateWeek(l.date)}</span>
        <span class="item-status">${formatDays(leaveDays(l))}</span>
      </div>
      <div class="item-sub">
        <span class="badge badge-${l.type}">${LEAVE_TYPES[l.type].short}</span>
        ${kindLabel(l)}
      </div>
      ${l.memo ? `<div class="item-memo">${escapeHtml(l.memo)}</div>` : ""}
      ${shortage ? `<div class="item-warn">残日数が ${formatDays(shortage)} 足りません</div>` : ""}
    </button>`;
}

// 一覧をタップしたら編集画面を開く
[plannedList, takenList].forEach((listEl) => {
  listEl.addEventListener("click", (e) => {
    const item = e.target.closest("[data-id]");
    if (item) openLeaveEdit(item.dataset.id);
  });
});

document.getElementById("leaveAddBtn").addEventListener("click", () => openLeaveForm());
