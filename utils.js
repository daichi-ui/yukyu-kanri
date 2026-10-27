// ===== 共通の設定と便利関数 =====

// 休暇の種別ごとの設定
export const LEAVE_TYPES = {
  paid: {
    label: "有給休暇",
    short: "有給",
    years: 2,        // 有効期限（年）
    grantMonth: 10   // 毎年の付与月
  },
  anniversary: {
    label: "アニバーサリー休暇",
    short: "アニバーサリー",
    years: 1,
    grantMonth: 4,
    days: 3          // 付与日数（固定）
  }
};

// Date → "2026-10-01"（日本時間のまま文字列にする）
export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "2026-10-01" → Date
export function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// 今日の日付 "2026-10-28"
export function today() {
  return toDateStr(new Date());
}

// 有効期限（最終日）を計算：付与日 + n年 − 1日
// 例：有給 2026-10-01 → 2028-09-30
export function calcExpireDate(grantDate, type) {
  const d = parseDate(grantDate);
  const years = LEAVE_TYPES[type].years;
  return toDateStr(new Date(d.getFullYear() + years, d.getMonth(), d.getDate() - 1));
}

// 直近の付与日（今日以前で一番新しい「○月1日」）
// 例：今日が 2026-10-28 で 10月なら 2026-10-01、4月なら 2026-04-01
export function latestGrantDate(month) {
  const now = new Date();
  let year = now.getFullYear();
  if (new Date(year, month - 1, 1) > now) year--;
  return toDateStr(new Date(year, month - 1, 1));
}

// "2026-10-01" → "2026年10月1日"
export function formatDate(str) {
  const d = parseDate(str);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// "2026-10-28" → "2026年10月28日(水)"
export function formatDateWeek(str) {
  const week = ["日", "月", "火", "水", "木", "金", "土"];
  return `${formatDate(str)}(${week.at(parseDate(str).getDay())})`;
}

// 20 → "20日"、0.125 → "0.125日"
export function formatDays(num) {
  return `${Number(Number(num).toFixed(3))}日`;
}

// 画面に表示する文字の安全対策（HTMLとして解釈させない）
export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
