// ===== データの読み込みと共有 =====
// 付与データと取得データを Firestore から読み込み、各画面に知らせる
import { db } from "./firebase.js";
import {
  collection, doc, setDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { LEAVE_TYPES, calcExpireDate, latestGrantDate } from "./utils.js";

export const state = {
  uid: null,
  grants: [],  // 付与データ
  leaves: []   // 取得データ（予定を含む）
};

const listeners = [];
let unsubscribes = [];

// データが変わったときに呼んでほしい処理を登録する
export function subscribe(fn) {
  listeners.push(fn);
}

function notify() {
  listeners.forEach((fn) => fn(state));
}

export function grantsRef() {
  return collection(db, "users", state.uid, "grants");
}

export function leavesRef() {
  return collection(db, "users", state.uid, "leaves");
}

// ===== 開始／終了 =====
export function initStore(user) {
  state.uid = user.uid;

  let firstGrants = true;
  unsubscribes.push(onSnapshot(grantsRef(), (snap) => {
    state.grants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    notify();
    if (firstGrants) {
      firstGrants = false;
      ensureAnniversaryGrant();
    }
  }));

  unsubscribes.push(onSnapshot(leavesRef(), (snap) => {
    state.leaves = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    notify();
  }));
}

export function stopStore() {
  unsubscribes.forEach((fn) => fn());
  unsubscribes = [];
  state.uid = null;
  state.grants = [];
  state.leaves = [];
  notify();
}

// ===== アニバーサリー休暇の自動付与 =====
// 直近の4月1日分がまだなければ、3日を自動で登録する
async function ensureAnniversaryGrant() {
  const grantDate = latestGrantDate(LEAVE_TYPES.anniversary.grantMonth);
  const exists = state.grants.some((g) => g.type === "anniversary" && g.grantDate === grantDate);
  if (exists) return;

  const year = grantDate.slice(0, 4);
  await setDoc(doc(db, "users", state.uid, "grants", `anniversary-${year}`), {
    type: "anniversary",
    grantDate,
    days: LEAVE_TYPES.anniversary.days,
    expireDate: calcExpireDate(grantDate, "anniversary"),
    memo: "自動付与",
    auto: true,
    createdAt: serverTimestamp()
  });
}
