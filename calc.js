// ===== 残日数の計算 =====
import { LEAVE_TYPES } from "./utils.js";

// 取得種類ごとの日数
export const LEAVE_KINDS = {
  full: { label: "全休" },
  am:   { label: "午前半休" },
  pm:   { label: "午後半休" },
  hour: { label: "時間休" }
};

export const HOURS_PER_DAY = 8;

// 1件の取得が何日分か
export function leaveDays(leave) {
  if (leave.kind === "am" || leave.kind === "pm") return 0.5;
  if (leave.kind === "hour") return Number(leave.hours) / HOURS_PER_DAY;
  return 1;
}

// 取得種類の表示名（時間休は時間数も付ける）
export function kindLabel(leave) {
  if (leave.kind === "hour") return `時間休 ${leave.hours}時間`;
  return LEAVE_KINDS[leave.kind]?.label ?? "";
}

const EPS = 1e-9; // 小数の誤差対策

/**
 * 付与と取得から残日数を計算する
 * ルール：取得日（予定日）に有効な付与分のうち、古いものから消化する
 *
 * 戻り値：
 *   remainByGrant[付与ID]   … その付与の残り日数
 *   shortageByLeave[取得ID] … 残日数が足りなかった日数（足りていれば無し）
 *   summary[種別]            … 今日時点の残日数・取得済み・予定
 */
export function calculate(grants, leaves, today) {
  const remainByGrant = {};
  const shortageByLeave = {};
  const summary = {};

  for (const type of Object.keys(LEAVE_TYPES)) {
    // 付与：古い順
    const gs = grants
      .filter((g) => g.type === type)
      .map((g) => ({ ...g, remain: Number(g.days) }))
      .sort((a, b) => a.grantDate.localeCompare(b.grantDate));

    // 取得：日付の古い順
    const ls = leaves
      .filter((l) => l.type === type)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

    // 1件ずつ、古い付与から差し引く
    for (const l of ls) {
      let need = leaveDays(l);
      for (const g of gs) {
        if (need <= EPS) break;
        const valid = g.grantDate <= l.date && l.date <= g.expireDate;
        if (!valid || g.remain <= EPS) continue;
        const use = Math.min(g.remain, need);
        g.remain -= use;
        need -= use;
      }
      if (need > EPS) shortageByLeave[l.id] = need;
    }

    gs.forEach((g) => { remainByGrant[g.id] = g.remain; });

    // 今日時点で有効な付与の残り（予定分は差し引き済み）
    const activeGrants = gs.filter((g) => g.grantDate <= today && today <= g.expireDate);
    const remaining = activeGrants.reduce((sum, g) => sum + g.remain, 0);

    // 次に失効する分（残りがあるもののうち一番早い期限）
    const nextExpire = activeGrants
      .filter((g) => g.remain > EPS)
      .sort((a, b) => a.expireDate.localeCompare(b.expireDate))[0];

    summary[type] = {
      remaining,
      taken: ls.filter((l) => l.date <= today).reduce((s, l) => s + leaveDays(l), 0),
      planned: ls.filter((l) => l.date > today).reduce((s, l) => s + leaveDays(l), 0),
      nextExpire: nextExpire ? { date: nextExpire.expireDate, days: nextExpire.remain } : null
    };
  }

  return { remainByGrant, shortageByLeave, summary };
}
