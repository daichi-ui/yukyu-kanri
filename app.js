import { auth } from "./firebase.js";
import { initStore, stopStore } from "./store.js";
import { resetGrantForm } from "./grants.js";
import "./leaves.js";
import "./home.js";
import "./calendar.js";
import { resetWorkForm } from "./workdays.js";
import { draggableSheet, closeSheet } from "./motion.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ===== 画面の要素 =====
const loading = document.getElementById("loading");
const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginError = document.getElementById("loginError");
const pageTitle = document.getElementById("pageTitle");
const navbar = document.getElementById("navbar");
const navTitle = document.getElementById("navTitle");
const accountSheet = document.getElementById("accountSheet");

// ===== ログイン状態で画面を切り替え =====
onAuthStateChanged(auth, (user) => {
  loading.hidden = true;
  if (user) {
    loginView.hidden = true;
    appView.hidden = false;
    setAccount(user);
    // URLの #calendar などを見て、開くタブを決める
    const tab = location.hash.replace("#", "") || "home";
    showTab(tab);
    // データの読み込みを開始
    initStore(user);
    resetGrantForm();
    resetWorkForm();
  } else {
    stopStore();
    appView.hidden = true;
    loginView.hidden = false;
  }
});

// ===== ログイン／ログアウト =====
document.getElementById("loginBtn").addEventListener("click", async () => {
  loginError.textContent = "";
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    loginError.textContent = "ログインに失敗しました：" + e.message;
  }
});

// ===== アカウントボタン（右上の丸いアイコン） =====
function setAccount(user) {
  const img = document.getElementById("avatarImg");
  const text = document.getElementById("avatarText");
  const name = user.displayName || user.email || "?";
  text.textContent = name.trim().charAt(0).toUpperCase();
  document.getElementById("accountEmail").textContent = user.email || "";
  if (user.photoURL) {
    img.src = user.photoURL;
    img.hidden = false;
    img.onerror = () => { img.hidden = true; };
  } else {
    img.hidden = true;
  }
}

document.getElementById("accountBtn").addEventListener("click", () => accountSheet.showModal());
document.getElementById("accountCancel").addEventListener("click", () => closeSheet(accountSheet));
accountSheet.addEventListener("click", (e) => {
  if (e.target === accountSheet) closeSheet(accountSheet);
});

// 入力シートは上のつまみを下にドラッグしても閉じる
draggableSheet(document.getElementById("leaveDialog"), closeSheet);

document.getElementById("logoutBtn").addEventListener("click", () => {
  accountSheet.close();
  signOut(auth);
});

// ===== 大きなタイトルの上の日付（例：10月30日 金曜日） =====
function updateToday() {
  const d = new Date();
  const week = ["日", "月", "火", "水", "木", "金", "土"].at(d.getDay());
  document.getElementById("todayText").textContent = `${d.getMonth() + 1}月${d.getDate()}日 ${week}曜日`;
}
updateToday();

// ===== スクロールしたら上のバーに小さいタイトルを出す =====
function onScroll() {
  navbar.classList.toggle("is-scrolled", window.scrollY > 44);
}
window.addEventListener("scroll", onScroll, { passive: true });

// ===== タブ切り替え =====
const TABS = ["home", "calendar", "grants"];
let current = null;

function showTab(name) {
  if (!TABS.includes(name)) name = "home";
  const changed = name !== current;
  current = name;

  // ページの表示切り替え（開いた画面はふわっと出す）
  document.querySelectorAll(".page").forEach((page) => {
    const show = page.id === `tab-${name}`;
    page.hidden = !show;
    if (show && changed) {
      page.classList.remove("page-enter");
      void page.offsetWidth;
      page.classList.add("page-enter");
    }
  });

  // タブボタンの見た目（選んだタブの下を板がすべる）
  document.querySelectorAll(".tab").forEach((btn, i) => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle("active", on);
    if (on) document.querySelector(".tabbar").style.setProperty("--tab", i);
  });

  // ヘッダーのタイトル
  const title = document.getElementById(`tab-${name}`).dataset.title;
  pageTitle.textContent = title;
  navTitle.textContent = title;

  // URLに残しておく（再読み込みしても同じタブを開く）
  history.replaceState(null, "", `#${name}`);
  window.scrollTo(0, 0);
  onScroll();
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

// ===== 管理画面の切り替え（付与／土曜出勤） =====
document.querySelectorAll(".segment").forEach((btn) => {
  btn.addEventListener("click", () => {
    const name = btn.dataset.seg;
    document.querySelectorAll(".segment").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    document.querySelectorAll(".seg-page").forEach((page) => {
      page.hidden = page.id !== `seg-${name}`;
      if (!page.hidden) {
        page.classList.remove("page-enter");
        void page.offsetWidth;
        page.classList.add("page-enter");
      }
    });
    btn.parentElement.style.setProperty("--seg", [...document.querySelectorAll(".segment")].indexOf(btn));
  });
});
