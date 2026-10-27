import { auth } from "./firebase.js";
import { initStore, stopStore } from "./store.js";
import { resetGrantForm } from "./grants.js";
import "./leaves.js";
import "./home.js";
import "./calendar.js";
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

// ===== ログイン状態で画面を切り替え =====
onAuthStateChanged(auth, (user) => {
  loading.hidden = true;
  if (user) {
    loginView.hidden = true;
    appView.hidden = false;
    // URLの #calendar などを見て、開くタブを決める
    const tab = location.hash.replace("#", "") || "home";
    showTab(tab);
    // データの読み込みを開始
    initStore(user);
    resetGrantForm();
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

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth);
});

// ===== タブ切り替え =====
const TABS = ["home", "calendar", "history", "grants"];

function showTab(name) {
  if (!TABS.includes(name)) name = "home";

  // ページの表示切り替え
  document.querySelectorAll(".page").forEach((page) => {
    page.hidden = page.id !== `tab-${name}`;
  });

  // タブボタンの見た目
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });

  // ヘッダーのタイトル
  pageTitle.textContent = document.getElementById(`tab-${name}`).dataset.title;

  // URLに残しておく（再読み込みしても同じタブを開く）
  history.replaceState(null, "", `#${name}`);
  window.scrollTo(0, 0);
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});
