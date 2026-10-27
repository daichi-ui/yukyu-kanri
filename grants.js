// ===== 付与管理 =====
import { db } from "./firebase.js";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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

// ===== 状態 =====
let uid = null;
let grants = [];        // 付与データの一覧
let editingId = null;   // 編集中のデータID（新規登録なら null）
let unsubscribe = null; // データ監視の停止用

// ===== 開始／終了（ログイン・ログアウト時に呼ぶ） =====
export function initGrants(user) {
  uid = user.uid;
  resetForm();

  let first = true;
  unsubscribe = onSnapshot(grantsRef(), (snap) => {
    grants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
    // 初回の読み込み後に、アニバーサリー休暇の自動付与を確認
    if (first) {
      first = false;
      ensureAnniversaryGrant();
    }
  });
}

export function stopGrants() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  uid = null;
  grants = [];
  list.innerHTML = "";
}

// 他の画面からも付与データを使えるようにする
export function getGrants() {
  return grants;
}

function grantsRef() {
  return collection(db, "users", uid, "grants");
}

// ===== アニバーサリー休暇の自動付与 =====
// 直近の4月1日分がまだなければ、3日を自動で登録する
async function ensureAnniversaryGrant() {
  const grantDate = latestGrantDate(LEAVE_TYPES.anniversary.grantMonth);
  const exists = grants.some((g) => g.type === "anniversary" && g.grantDate === grantDate);
  if (exists) return;

  const year = grantDate.slice(0, 4);
  await setDoc(doc(db, "users", uid, "grants", `anniversary-${year}`), {
    type: "anniversary",
    grantDate,
    days: LEAVE_TYPES.anniversary.days,
    expireDate: calcExpireDate(grantDate, "anniversary"),
    memo: "自動付与",
    auto: true,
    createdAt: serverTimestamp()
  });
}

// ===== フォーム =====

// 新規登録の初期状態に戻す
function resetForm() {
  editingId = null;
  form.reset();
  formTitle.textContent = "付与を登録";
  submitBtn.textContent = "登録する";
  cancelBtn.hidden = true;
  typeInput.disabled = false;
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
cancelBtn.addEventListener("click", resetForm);

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
  const duplicate = grants.some(
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
    if (editingId) {
      await updateDoc(doc(grantsRef(), editingId), data);
      showMsg("更新しました");
    } else {
      await addDoc(grantsRef(), { ...data, createdAt: serverTimestamp() });
      showMsg("登録しました");
    }
    resetForm();
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
  const g = grants.find((x) => x.id === id);
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
  const g = grants.find((x) => x.id === id);
  if (!g) return;
  const label = `${LEAVE_TYPES[g.type].short} ${formatDate(g.grantDate)} 付与分`;
  if (!confirm(`${label}を削除しますか？`)) return;
  try {
    await deleteDoc(doc(grantsRef(), id));
    if (editingId === id) resetForm();
  } catch (err) {
    alert("削除に失敗しました：" + err.message);
  }
}

// ===== 一覧の表示 =====
function render() {
  if (grants.length === 0) {
    list.innerHTML = `<p class="empty">まだ付与が登録されていません</p>`;
    return;
  }

  const t = today();
  const sorted = [...grants].sort((a, b) => b.grantDate.localeCompare(a.grantDate));

  list.innerHTML = sorted.map((g) => {
    const expired = g.expireDate < t;
    return `
      <div class="item ${expired ? "is-expired" : ""}">
        <div class="item-head">
          <span class="badge badge-${g.type}">${LEAVE_TYPES[g.type].short}</span>
          <span class="item-days">${formatDays(g.days)}</span>
          <span class="item-status">${expired ? "失効" : "有効"}</span>
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
