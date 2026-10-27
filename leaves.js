// ===== 取得・予定の登録・編集・削除（入力画面） =====
import {
  doc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { state, leavesRef } from "./store.js";
import { calculate } from "./calc.js";
import { today, formatDays } from "./utils.js";

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

let editingId = null; // 編集中のデータID（新規登録なら null）

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
