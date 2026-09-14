/**
 * 捲動分批載入（MoreList）用的清單設定。
 *
 * 只給 /works/ 用（250–500 筆）：
 *   1. 頁面本身只 SSR 前 MORE_INITIAL 部
 *   2. 其餘切成每 MORE_CHUNK 部一個 JSON（/more/works/<n>.json，build 時全靜態產生）
 *   3. 前端捲到底每次補 MORE_BATCH 部
 *
 * creators（≤50）與 posts / events 都一頁列完，不走這套。
 */
import { getSiteData, type Work } from './queries';

export const MORE_INITIAL = 24;
export const MORE_BATCH = 12;
export const MORE_CHUNK = 24;

export const WORKS_KEY = 'works';

/** 各 listKey 對應的完整清單（目前只有 works） */
export async function getMoreLists(): Promise<Map<string, Work[]>> {
  const d = await getSiteData();
  return new Map([[WORKS_KEY, d.works]]);
}

/** 該清單需要幾個 JSON chunk（不含 SSR 已輸出的前 MORE_INITIAL 部） */
export function chunkCount(total: number): number {
  return Math.ceil(Math.max(0, total - MORE_INITIAL) / MORE_CHUNK);
}

/** 第 page 個 chunk（1-based）對應的切片 */
export function chunkSlice<T>(items: T[], page: number): T[] {
  const rest = items.slice(MORE_INITIAL);
  return rest.slice((page - 1) * MORE_CHUNK, page * MORE_CHUNK);
}

/**
 * 清單版本戳（HTML 與 JSON 的對帳碼）。
 *
 * 分批載入是「位置偏移」切片（chunkSlice 的 slice(MORE_INITIAL)），所以頁面的
 * HTML 與 /more/<key>/<n>.json 必須來自同一次 build。部署後還開著的舊分頁會拿到
 * 新 JSON，偏移就錯位——同一部作品重複出現，中間的作品被整段跳過。
 * 兩邊都帶這個值，前端對不上就重載換回同一版。
 *
 * FNV-1a 雜湊「總數 + 依序的 slug」：順序、增刪、換片都會讓它改變。
 */
export function listVersion(works: Work[]): string {
  const src = `${works.length}:${works.map((w) => w.data.slug).join(',')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i += 1) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
