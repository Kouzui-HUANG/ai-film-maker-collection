/**
 * resources.mjs — 「工具資源」分區的條目登記
 *
 * 每筆對應一個手寫頁面 src/pages/resource/<slug>.astro（互動工具不走 content collection）。
 * /resources/ 列表、/sitemap/、文章頁的「相關工具」、sitemap lastmod 與 llms.txt 都讀這裡，
 * 所以必須是純 Node 讀得到的 .mjs：astro.config.mjs 會 import，不要在這裡 import 圖片或 astro:*。
 * 封面圖放 src/assets/resources/<slug>.jpg（1600×900），由頁面以 import.meta.glob 取用。
 */

/** @type {Record<string, string>} */
export const RESOURCE_KIND_LABEL = {
  calculator: '試算器',
  image: '影像工具',
};

/**
 * @typedef {object} Resource
 * @property {string} slug        網址 /resource/<slug>/
 * @property {keyof typeof RESOURCE_KIND_LABEL} kind
 * @property {string} title       頁面 h1 與列表標題
 * @property {string} excerpt     列表摘要與 llms.txt 說明（≤ 120 字）
 * @property {string} coverAlt    封面圖的 alt：描述實際畫面
 * @property {string} published   上線日（YYYY-MM-DD）
 * @property {string} updated     最後更新日（sitemap lastmod）
 * @property {string} [dataDate]  依據資料的日期（例：模型單價快照）
 * @property {string} [basedOn]   依據文章的 urlSlug；該文章頁會顯示「相關工具」
 * @property {string} [pitch]     依據文章頁「相關工具」框裡的一句話（省略時用 excerpt）
 * @property {string} cta         列表與文章頁上的按鈕文字（動詞開頭）
 */

/** @type {Resource[]} 新的放最前面 */
export const RESOURCES = [
  {
    slug: 'ai-image-denoise',
    kind: 'image',
    title: 'AI 圖片色雜訊診斷與降噪',
    excerpt:
      '把 AI 生成的圖放進瀏覽器，先看 1 到 5 級的色雜訊等級，再用「只看顏色」找出彩色顆粒與斑駁色塊，一鍵抹平顏色的雜訊；牆面、天空的亮暗斑可再用「亮度斑駁」淡化，木紋、布紋會留著。全部在你的電腦上計算，圖片不會上傳。',
    coverAlt:
      '深褐底上一幅「只看顏色」檢視：藍灰背景前一顆橘紅色的圓，中間一條白線分開，左半邊布滿彩色細點，右半邊顏色平滑；下方左右標著原圖與降噪後，中間是「只看顏色 × 4」',
    published: '2026-11-25',
    updated: '2026-11-26',
    basedOn: 'gpt-image-color-noise',
    pitch: '本文案例用的就是這個工具：放進自己的圖，先看色雜訊等級，再用「亮度斑駁」和「紋理保護」放大比較。全部在瀏覽器裡計算，圖片不會上傳。',
    cta: '開啟降噪工具',
  },
  {
    slug: 'ai-video-cost-calculator',
    kind: 'calculator',
    title: 'AI 影片算力成本試算器',
    excerpt:
      '輸入片長、採用率、修改預備量與模型單價，算出一支 AI 影片要準備多少新台幣的生成算力，也能把人日加進來估總價。內建四個情境，可一鍵套用，再用拉桿微調。',
    coverAlt:
      '深褐底上四條橫向長條，由上而下標著 30 s、3 min、10 × 1 min、100 min 與各自的新台幣總價；每條左段的靛藍色是算力費占比，從 4.9% 到 36.2%，其餘深色段是人力費',
    published: '2026-11-25',
    updated: '2026-11-25',
    dataDate: '2026-09-15',
    basedOn: 'ai-video-production-cost',
    pitch: '本文的公式已做成試算器：換上自己的片長、採用率與模型單價，就能算出要準備多少新台幣。',
    cta: '開啟試算器',
  },
];

/** @param {string} urlSlug */
export function resourcesBasedOn(urlSlug) {
  return RESOURCES.filter((r) => r.basedOn === urlSlug);
}
