/**
 * 時效性引擎（§1-3 ①）：events 在 build 時計算 upcoming / ongoing / past。
 *
 * ⚠️ 靜態站陷阱：build 時算出的「即將舉行」會過期。
 *    .github/workflows/deploy.yml 排程每日重建，否則活動頁會停在上次 push 的狀態。
 *
 * 純函式、不碰 astro:content，方便 scripts/ 與測試重用。
 */

export type EventStatus = 'upcoming' | 'ongoing' | 'past';

export interface EventDates {
  startDate: string;      // "YYYY-MM-DD"
  endDate?: string;
  deadline?: string;
}

export interface EventTiming {
  status: EventStatus;
  /** 距開始日的天數（負數 = 已開始） */
  daysUntilStart: number;
  /** 距報名截止的天數；沒有 deadline 為 null（負數 = 已截止） */
  daysUntilDeadline: number | null;
  /** 有 deadline 且已過 */
  deadlinePassed: boolean;
  /** 活動實際結束日（endDate ?? startDate） */
  lastDay: string;
}

const MS_PER_DAY = 86_400_000;

/** 以台北時區（UTC+8）取得 build 當天的 "YYYY-MM-DD" */
export function todayTaipei(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 兩個 "YYYY-MM-DD" 的日差（b - a），以整天計 */
export function diffDays(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((tb - ta) / MS_PER_DAY);
}

export function computeTiming(dates: EventDates, today: string): EventTiming {
  const lastDay = dates.endDate ?? dates.startDate;
  let status: EventStatus;
  if (lastDay < today) status = 'past';
  else if (dates.startDate > today) status = 'upcoming';
  else status = 'ongoing';

  const daysUntilStart = diffDays(today, dates.startDate);
  const daysUntilDeadline = dates.deadline ? diffDays(today, dates.deadline) : null;

  return {
    status,
    daysUntilStart,
    daysUntilDeadline,
    deadlinePassed: daysUntilDeadline !== null && daysUntilDeadline < 0,
    lastDay,
  };
}

/** upcoming / ongoing 依 startDate 正序 */
export function sortUpcoming<T extends { data: EventDates }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.data.startDate.localeCompare(b.data.startDate));
}

/** past 依 startDate 倒序 */
export function sortPast<T extends { data: EventDates }>(list: T[]): T[] {
  return [...list].sort((a, b) => b.data.startDate.localeCompare(a.data.startDate));
}

/** 顯示用：2026-10-03 → 2026.10.03 */
export function fmtDate(d?: string | null): string {
  return d ? d.replace(/-/g, '.') : '';
}

/** 顯示用：日期範圍（同日只顯示一次） */
export function fmtRange(start: string, end?: string): string {
  if (!end || end === start) return fmtDate(start);
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

/**
 * 倒數文案（活動卡片右上角）：
 *   upcoming → 「3 天後開始」／「今天開始」
 *   ongoing  → 「進行中」
 *   past     → 「已結束」
 */
export function countdownLabel(t: EventTiming): string {
  if (t.status === 'past') return '已結束';
  if (t.daysUntilStart === 0) return '今天開始';   // 開始當天（status 已是 ongoing）優先顯示「今天開始」
  if (t.status === 'ongoing') return '進行中';
  if (t.daysUntilStart === 1) return '明天開始';
  return `${t.daysUntilStart} 天後開始`;
}

/** 報名截止文案；沒有 deadline 回空字串 */
export function deadlineLabel(t: EventTiming, deadline?: string): string {
  if (!deadline || t.daysUntilDeadline === null) return '';
  if (t.daysUntilDeadline < 0) return `報名已截止（${fmtDate(deadline)}）`;
  if (t.daysUntilDeadline === 0) return '今天截止報名';
  return `報名截止 ${fmtDate(deadline)}（剩 ${t.daysUntilDeadline} 天）`;
}
