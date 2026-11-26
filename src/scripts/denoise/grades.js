/**
 * grades.js — 色雜訊等級的門檻與文字（denoise-core.js 算指數、app.ts 顯示、頁面說明都讀這裡，改一處就好）
 *
 * 指數大約等於「平滑區域裡顏色起伏的色差（ΔE）」。門檻每級加倍；校準方法見 denoise-core.js 的 measureNoise。
 * 純資料：沒有 DOM，Astro 頁面的 frontmatter 也 import 得到。
 */

/** 指數到這個值就升一級：< 0.5 是 1 級，0.5～1 是 2 級，以此類推，4 以上是 5 級 */
export const GRADE_STEPS = [0.5, 1, 2, 4];

/** @type {{ name: string, desc: string }[]} 依序是 1～5 級 */
export const GRADES = [
  { name: '乾淨', desc: '放大到 200% 也幾乎看不到彩色顆粒或色斑。' },
  { name: '輕微', desc: '切到「只看顏色」或放大到 200% 才看得出來，一般觀看不受影響。' },
  { name: '明顯', desc: '放大到 100% 細看就看得到彩色斑點，膚色、天空、牆面這種大片平滑的地方最明顯。' },
  { name: '嚴重', desc: '照一般大小看，就看得出顏色斑駁。' },
  { name: '非常嚴重', desc: '一眼就看到彩色雜點。' },
];

/** @param {number} score */
export function gradeLevel(score) {
  return 1 + GRADE_STEPS.filter((t) => score >= t).length;
}
