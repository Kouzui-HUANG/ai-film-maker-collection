/**
 * site.config.mjs — 部署位置的單一真相來源
 *
 * astro.config.mjs 與 src/data/site.ts 都從這裡讀，避免兩邊漂移。
 *
 * GitHub Pages 有兩種位址型態：
 *   1. 專案站：https://<user>.github.io/<repo>/   → BASE_PATH = /<repo>
 *   2. 使用者站或自訂網域：https://example.com/   → BASE_PATH = /
 *
 * 本站走第 2 種：正式網域 hallucination28.com（public/CNAME + Actions Variable SITE_ORIGIN），
 * 所以 base 是 '/'。.github/workflows/deploy.yml 會在 build 前把這兩個值算好寫進環境變數；
 * 本機 build 若未設定環境變數，就用下面的預設值（與正式站一致）。
 *
 * 要模擬舊的專案站位址：
 *   SITE_ORIGIN=https://kouzui-huang.github.io BASE_PATH=/ai-film-maker-collection npm run build
 */

function normalizeBase(raw) {
  if (!raw || raw === '/') return '/';
  return '/' + raw.replace(/^\/+|\/+$/g, '');
}

export const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://hallucination28.com').replace(/\/+$/, '');
try {
  const u = new URL(SITE_ORIGIN);
  if (!/^https?:$/.test(u.protocol)) throw new Error('protocol');
} catch {
  throw new Error(`SITE_ORIGIN 須為含 https:// 的完整網址（目前：「${SITE_ORIGIN}」）`);
}
export const BASE_PATH = normalizeBase(process.env.BASE_PATH ?? '/');

/** 完整站台 URL（含 base，無結尾斜線）：絕對連結、canonical、JSON-LD @id 一律用這個 */
export const SITE_URL = BASE_PATH === '/' ? SITE_ORIGIN : `${SITE_ORIGIN}${BASE_PATH}`;
