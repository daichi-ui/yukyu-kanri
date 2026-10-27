// ===== 付与管理 =====
import {
  doc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { state, subscribe, grantsRef } from "./store.js";
import { calculate } from "./calc.js";
import {
  LEAVE_TYPES, today, calcExpireDate, latestGrantDate, formatDate, formatDays, escapeHtml
} from "./utils.js";

// ===== 画面の要素 =====
const form = document.getElementById("grantForm");
const formTitle = document.getElementById("grantFormTitle");
const typeInput = document.getElementById("grantType");
const dateInput = document.getElementById("grantDate");
const daysInput = document.getElementById("grantDays");
const memoInput = document.getElementById("grantMemo");
const expireText = document.getElementById("grantExpire");
const submitBtn = document.getElementById("grantSubmit");
const cancelBtn = document.getElementById("grantCancel");
const msg = document.getElementById("grantMsg");
const list = document.getElementById("grantList");

let editingId = null; // 編集中のデータID（新規登録なら null）

// データが変わったら一覧を描き直す
subscribe(render);

// ===== フォーム =====

// 新規登録の初期状態に戻す
export function resetGrantForm() {
  editingId = null;
  form.reset();
  formTitle.textContent = "付与を登録";
  submitBtn.textContent = "登録する";
  cancelBtn.hidden = true;
  typeInput.disabled = false;
  msg.textContent = "";
  setDefaults();
}

// 種別に合わせて、付与日と日数の初期値を入れる
function setDefaults() {
  const type = typeInput.value;
  dateInput.value = latestGrantDate(LEAVE_TYPES[type].grantMonth);
  daysInput.value = type === "anniversary" ? LEAVE_TYPES.anniversary.days : "";
  updateExpire();
}

// 有効期限の表示を更新
function updateExpire() {
  expireText.textContent = dateInput.value
    ? formatDate(calcExpireDate(dateInput.value, typeInput.value))
    : "-";
}

typeInput.addEventListener("change", () => {
  if (!editingId) setDefaults();
  else updateExpire();
});
dateInput.addEventListener("change", updateExpire);
cancelBtn.addEventListener("click", resetGrantForm);

// 登録・更新
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";

  const type = typeInput.value;
  const grantDate = dateInput.value;
  const days = Number(daysInput.value);

  if (!grantDate) return showMsg("付与日を入力してください", true);
  if (!(days > 0)) return showMsg("付与日数を正しく入力してください", true);

  // 同じ種別・同じ付与日のデータがすでにあれば確認する
  const duplicate = state.grants.some(
    (g) => g.type === type && g.grantDate === grantDate && g.id !== editingId
  );
  if (duplicate && !confirm("同じ付与日のデータがすでにあります。登録しますか？")) return;

  const data = {
    type,
    grantDate,
    days,
    expireDate: calcExpireDate(grantDate, type),
    memo: memoInput.value.trim()
  };

  submitBtn.disabled = true;
  try {
    const wasEditing = !!editingId;
    if (wasEditing) {
      await updateDoc(doc(grantsRef(), editingId), data);
    } else {
      await addDoc(grantsRef(), { ...data, createdAt: serverTimestamp() });
    }
    resetGrantForm();
    showMsg(wasEditing ? "更新しました" : "登録しました");
  } catch (err) {
    showMsg("保存に失敗しました：" + err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

function showMsg(text, isError = false) {
  msg.textContent = text;
  msg.classList.toggle("error", isError);
}

// 編集モードにする
function startEdit(id) {
  const g = state.grants.find((x) => x.id === id);
  if (!g) return;
  editingId = id;
  typeInput.value = g.type;
  typeInput.disabled = !!g.auto; // 自動付与は種別を変えない
  dateInput.value = g.grantDate;
  daysInput.value = g.days;
  memoInput.value = g.memo || "";
  updateExpire();
  formTitle.textContent = "付与を編集";
  submitBtn.textContent = "更新する";
  cancelBtn.hidden = false;
  msg.textContent = "";
  form.scrollIntoView({ behavior: "smooth" });
}

// 削除
async function remove(id) {
  const g = state.grants.find((x) => x.id === id);
  if (!g) return;
  const label = `${LEAVE_TYPES[g.type].short} ${formatDate(g.grantDate)} 付与分`;
  if (!confirm(`${label}を削除しますか？`)) return;
  try {
    await deleteDoc(doc(grantsRef(), id));
    if (editingId === id) resetGrantForm();
  } catch (err) {
    alert("削除に失敗しました：" + err.message);
  }
}

// ===== 一覧の表示 =====
function render() {
  if (!state.uid) {
    list.innerHTML = "";
    return;
  }
  if (state.grants.length === 0) {
    list.innerHTML = `<p class="empty">まだ付与が登録されていません</p>`;
    return;
  }

  const t = today();
  const { remainByGrant } = calculate(state.grants, state.leaves, t);
  const sorted = [...state.grants].sort((a, b) => b.grantDate.localeCompare(a.grantDate));

  list.innerHTML = sorted.map((g) => {
    const expired = g.expireDate < t;
    const notYet = g.grantDate > t;
    const status = expired ? "失効" : notYet ? "付与前" : "有効";
    const remain = remainByGrant[g.id] ?? g.days;
    return `
      <div class="item ${expired ? "is-expired" : ""}">
        <div class="item-head">
          <span class="badge badge-${g.type}">${LEAVE_TYPES[g.type].short}</span>
          <span class="item-days">残り ${formatDays(remain)}</span>
          <span class="item-total">／ ${formatDays(g.days)}</span>
          <span class="item-status">${status}</span>
        </div>
        <div class="item-sub">
          付与日 ${formatDate(g.grantDate)}<br>
          期限 ${formatDate(g.expireDate)}
        </div>
        ${g.memo ? `<div class="item-memo">${escapeHtml(g.memo)}</div>` : ""}
        <div class="item-actions">
          <button class="btn-small" data-edit="${g.id}">編集</button>
          ${g.auto ? "" : `<button class="btn-small btn-danger" data-delete="${g.id}">削除</button>`}
        </div>
      </div>`;
  }).join("");
}

// 一覧のボタン（編集・削除）
list.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.edit) startEdit(btn.dataset.edit);
  if (btn.dataset.delete) remove(btn.dataset.delete);
});
