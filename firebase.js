// Firebase の初期化（設定はここだけで管理する）
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDaVnPZzXxzUw5HICkCVkqQiMjeeyDoaGA",
  authDomain: "paidtimeoff-3176d.firebaseapp.com",
  projectId: "paidtimeoff-3176d",
  storageBucket: "paidtimeoff-3176d.firebasestorage.app",
  messagingSenderId: "630941187964",
  appId: "1:630941187964:web:d99d66bcfdb665110caef9"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
