// ===== 動き =====
// 動きを減らす設定の端末では、すぐに最終の状態にする
export const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 数字をカウントアップ（またはダウン）させる。小数は最大3桁まで
export function animateNumber(el, from, to, duration = 900) {
  if (!el) return;
  const fmt = (v) => String(Number(v.toFixed(3)));
  if (reduceMotion() || from === to) {
    el.textContent = fmt(to);
    return;
  }
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 4);
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    // 途中は 0.5 刻みで見せ、最後に正確な値にする
    el.textContent = t < 1 ? fmt(Math.round((from + (to - from) * ease(t)) * 2) / 2) : fmt(to);
    if (t < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// 登録したときの小さな紙吹雪（ボタンのあたりから）
const BURST_COLORS = ["var(--paid)", "var(--anniv)", "var(--indigo)", "var(--sun)"];
export function burst(x, y) {
  if (reduceMotion()) return;
  const layer = document.createElement("div");
  layer.className = "burst";
  layer.style.left = `${x}px`;
  layer.style.top = `${y}px`;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement("span");
    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.3;
    const dist = 60 + Math.random() * 70;
    p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--dy", `${Math.sin(angle) * dist - 30}px`);
    p.style.setProperty("--rot", `${Math.random() * 540 - 270}deg`);
    p.style.background = BURST_COLORS.at(i % BURST_COLORS.length);
    if (i % 3 === 0) p.classList.add("is-round");
    layer.append(p);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1100);
}

// シートを下にドラッグして閉じる（上のつまみ・見出しのあたりをつかむ）
export function draggableSheet(dialog, close) {
  const handle = dialog.querySelector(".sheet-bar");
  if (!handle) return;
  let y0 = null, dy = 0;
  handle.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, input, select")) return;
    y0 = e.clientY;
    dy = 0;
    dialog.style.transition = "none";
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (y0 === null) return;
    dy = Math.max(0, e.clientY - y0);
    dialog.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (y0 === null) return;
    y0 = null;
    dialog.style.transition = "";
    dialog.style.transform = "";
    if (dy > 110) close(dialog);
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

// 下へすべらせてから閉じる
export function closeSheet(dialog) {
  if (!dialog.open || dialog.classList.contains("is-closing")) return;
  dialog.classList.add("is-closing");
  setTimeout(() => { dialog.close(); dialog.classList.remove("is-closing"); }, 220);
}

// ===== 画面下に短く出るお知らせ =====
let toastEl = null;
let toastTimer = null;
export function toast(text) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.setAttribute("role", "status");
    document.body.append(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.remove("is-show");
  void toastEl.offsetWidth;
  toastEl.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 2400);
}
