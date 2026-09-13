/**
 * 作品類型受控詞彙（與工具正交的第二條索引軸）。
 *
 * ⚠️ 類型一律由編輯部人工填寫，不做自動推斷；`npm run check` 會驗證每個值都在此清單。
 */

export interface GenreDef {
  slug: string;
  label: string;
  labelEn: string;
  /** 類型索引頁介紹文 + meta description */
  note: string;
}

/** 建立 /genre/<slug>/ 頁的最低作品數門檻；低於此的類型頁輸出 noindex（§3-2） */
export const MIN_GENRE_WORKS = 3;

export const GENRES: GenreDef[] = [
  { slug: 'short-film', label: '短片', labelEn: 'SHORT FILM', note: '有完整敘事的 AI 短片，從一分鐘的極短篇到二十分鐘的中篇都收在這裡。' },
  { slug: 'commercial', label: '廣告', labelEn: 'COMMERCIAL', note: '品牌委製或概念提案的 AI 廣告影片，含產品形象片與社群版本。' },
  { slug: 'music-video', label: 'MV', labelEn: 'MUSIC VIDEO', note: '以 AI 生成畫面製作的音樂錄影帶，包含 AI 生成音樂與真人音樂的作品。' },
  { slug: 'documentary', label: '紀錄片', labelEn: 'DOCUMENTARY', note: '以 AI 重建歷史場景或輔助敘事的紀錄片與紀錄式短片。' },
  { slug: 'animation', label: '動畫', labelEn: 'ANIMATION', note: '以 AI 生成或輔助的動畫作品，包含 2D 風格、3D 風格與定格質感。' },
  { slug: 'experimental', label: '實驗片', labelEn: 'EXPERIMENTAL', note: '探索 AI 影像語言本身的實驗作品：非敘事、視覺詩、生成式影像裝置。' },
  { slug: 'trailer', label: '預告', labelEn: 'TRAILER', note: '概念預告片與提案用 proof-of-concept：用 AI 先把世界觀「拍出來」。' },
];

export const GENRE_BY_SLUG: Record<string, GenreDef> = Object.fromEntries(GENRES.map((g) => [g.slug, g]));

export function genreLabel(slug: string): string {
  return GENRE_BY_SLUG[slug]?.label ?? slug;
}

export function getGenreWorkCounts(works: { genre: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const w of works) counts.set(w.genre, (counts.get(w.genre) ?? 0) + 1);
  return counts;
}

/** 該類型頁是否達到 index 門檻（未達則仍建頁但 noindex） */
export function genreIsIndexable(counts: Map<string, number>, slug: string): boolean {
  return (counts.get(slug) ?? 0) >= MIN_GENRE_WORKS;
}

/* ── 其他小型受控詞彙（純顯示用，不建頁） ────────────────── */

export const EVENT_KIND_LABEL: Record<string, string> = {
  competition: '比賽',
  workshop: '工作坊',
  screening: '放映',
  talk: '講座',
  exhibition: '展覽',
};

export const POST_TYPE_LABEL: Record<string, { label: string; labelEn: string }> = {
  interview: { label: '訪談', labelEn: 'INTERVIEW' },
  tutorial: { label: '教學', labelEn: 'TUTORIAL' },
};

export const LEVEL_LABEL: Record<string, string> = {
  beginner: '入門',
  intermediate: '進階',
  advanced: '高階',
};
