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
