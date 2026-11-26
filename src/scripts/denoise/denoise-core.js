/**
 * denoise-core.js — AI 圖片色雜訊降噪的計算核心（純函式：沒有 DOM、沒有網路）
 *
 * denoise.worker.js 在 Web Worker 裡呼叫，畫面不會卡住；Node 也能 import（驗證用）。
 *
 * 1. 色雜訊（radius > 0）：轉成 Lab，亮度 L 不動，只把顏色 a、b 用 guided filter（He et al., 2010）
 *    照著 L 的邊緣抹平，嘴唇的粉紅、頭髮的黑不會滲到皮膚。
 * 2. 膚色均勻（blotch > 0）：亮度先輕微模糊（毛孔、髮絲這種 2 像素以下的細節留在原圖，不動），再用 guided filter
 *    只把對比低、中等大小的不均勻拉回周圍的亮度；有真正對比的五官（眼睛、鼻孔、唇線、下巴）保留，
 *    膚色遮罩（暖色、中等飽和、中等亮度）讓頭髮、衣服、背景不受影響。
 * 3. 診斷檢視（layer）：只看顏色（亮度拉平、顏色放大）、改變幅度（ΔE 熱圖）、膚色範圍（遮罩）。
 * 4. 色雜訊指數（measureNoise）：平滑區域裡和亮度無關的顏色起伏，換成 1～5 級的門檻在 grades.js。
 *
 * 邊界、Lab 常數、高斯核心大小都照 OpenCV（boxFilter BORDER_REFLECT、GaussianBlur BORDER_REFLECT_101），
 * 和 OpenCV＋numpy 寫的同一套演算法逐像素對照過：8 位元的像素幾乎都相同或差 1。
 * 透明度照原圖。
 */

const EPS = 1.0;                         // 色彩邊緣的敏感度（固定，不讓使用者調）
const BLOTCH_R = 10, BLOTCH_EPS = 9.0;   // 膚色均勻的 guided filter
const T = 0.008856, F16 = 16 / 116;      // Lab 的分段點（和 OpenCV 用的常數一樣）

// OpenCV 的邊界：boxFilter 用 BORDER_REFLECT（cba|abc），GaussianBlur 預設 BORDER_REFLECT_101（dcb|abc）
function reflect(i, n) {
  if (n === 1) return 0;
  while (i < 0 || i >= n) i = i < 0 ? -i - 1 : 2 * n - i - 1;
  return i;
}
function reflect101(i, n) {
  if (n === 1) return 0;
  while (i < 0 || i >= n) i = i < 0 ? -i : 2 * n - i - 2;
  return i;
}

// cv2.boxFilter（正規化的方框平均）：先橫向、再縱向的移動平均，累加用 double。src 和 dst 可以是同一個
function box(src, dst, w, h, r, s) {
  const k = 2 * r + 1, inv = 1 / k, tmp = s.tmp, row = new Float64Array(w + 2 * r), acc = s.acc;
  for (let y = 0; y < h; y++) {
    const off = y * w;
    for (let j = -r; j < w + r; j++) row[j + r] = src[off + (j < 0 || j >= w ? reflect(j, w) : j)];
    let sum = 0;
    for (let j = 0; j < k; j++) sum += row[j];
    tmp[off] = sum * inv;
    for (let x = 1; x < w; x++) {
      sum += row[x + 2 * r] - row[x - 1];
      tmp[off + x] = sum * inv;
    }
  }
  acc.fill(0);
  for (let j = -r; j <= r; j++) {
    const o = reflect(j, h) * w;
    for (let x = 0; x < w; x++) acc[x] += tmp[o + x];
  }
  for (let y = 0; y < h; y++) {
    const off = y * w;
    for (let x = 0; x < w; x++) dst[off + x] = acc[x] * inv;
    if (y + 1 < h) {
      const add = reflect(y + 1 + r, h) * w, sub = reflect(y - r, h) * w;
      for (let x = 0; x < w; x++) acc[x] += tmp[add + x] - tmp[sub + x];
    }
  }
  return dst;
}

// cv2.GaussianBlur(src, (0, 0), sigma)：浮點數的圖核心大小是 round(sigma*8+1)|1，邊界 BORDER_REFLECT_101
function gaussKernel(sigma) {
  const n = Math.round(sigma * 8 + 1) | 1, c = (n - 1) / 2, k = new Float32Array(n), e = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += e[i] = Math.exp(-0.5 * (i - c) * (i - c) / (sigma * sigma));
  for (let i = 0; i < n; i++) k[i] = e[i] / sum;
  return k;
}
// 核心左右對稱：對稱的兩個先相加再乘，乘法少一半
function gauss(src, dst, w, h, sigma, s) {
  const k = gaussKernel(sigma), n = k.length, R = (n - 1) >> 1, kc = k[R], tmp = s.tmp, row = new Float64Array(w + 2 * R), acc = s.acc;
  for (let y = 0; y < h; y++) {
    const off = y * w;
    for (let j = -R; j < w + R; j++) row[j + R] = src[off + (j < 0 || j >= w ? reflect101(j, w) : j)];
    for (let x = 0; x < w; x++) {
      let v = kc * row[x + R];
      for (let i = 0; i < R; i++) v += k[i] * (row[x + i] + row[x + n - 1 - i]);
      tmp[off + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    const oc = y * w;
    for (let x = 0; x < w; x++) acc[x] = kc * tmp[oc + x];
    for (let i = 0; i < R; i++) {
      const o1 = reflect101(y + i - R, h) * w, o2 = reflect101(y + R - i, h) * w, ki = k[i];
      for (let x = 0; x < w; x++) acc[x] += ki * (tmp[o1 + x] + tmp[o2 + x]);
    }
    for (let x = 0; x < w; x++) dst[oc + x] = acc[x];
  }
  return dst;
}

// cv2.cvtColor(RGB 0..1 的浮點數, COLOR_RGB2Lab)：sRGB 解 gamma → XYZ（D65）→ Lab，L 0..100
const LIN = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const v = i / 255;
  LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
const fLab = t => t > T ? Math.cbrt(t) : 7.787 * t + F16;
function toLab(rgba, L, A, B) {
  for (let i = 0, p = 0; i < L.length; i++, p += 4) {
    const r = LIN[rgba[p]], g = LIN[rgba[p + 1]], b = LIN[rgba[p + 2]];
    const X = (0.412453 * r + 0.357580 * g + 0.180423 * b) / 0.950456;
    const Y = 0.212671 * r + 0.715160 * g + 0.072169 * b;
    const Z = (0.019334 * r + 0.119193 * g + 0.950227 * b) / 1.088754;
    const fy = fLab(Y);
    L[i] = Y > T ? 116 * fy - 16 : 903.3 * Y;
    A[i] = 500 * (fLab(X) - fy);
    B[i] = 200 * (fy - fLab(Z));
  }
}
// COLOR_Lab2RGB，再照 np.clip(out * 255 + 0.5, 0, 255) 轉成 8 位元；透明度照原圖
const L_T = T * 903.3, F_T = 7.787 * T + F16;
const gamma = v => v <= 0 ? 0 : v >= 1 ? 1 : v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
function fromLab(L, A, B, rgba, out) {
  for (let i = 0, p = 0; i < L.length; i++, p += 4) {
    const li = L[i];
    let y, fy;
    if (li <= L_T) { y = li / 903.3; fy = 7.787 * y + F16; } else { fy = (li + 16) / 116; y = fy * fy * fy; }
    let fx = A[i] / 500 + fy, fz = fy - B[i] / 200;
    fx = fx <= F_T ? (fx - F16) / 7.787 : fx * fx * fx;
    fz = fz <= F_T ? (fz - F16) / 7.787 : fz * fz * fz;
    const x = fx * 0.950456, z = fz * 1.088754;
    out[p] = Math.floor(gamma(3.240479 * x - 1.53715 * y - 0.498535 * z) * 255 + 0.5);
    out[p + 1] = Math.floor(gamma(-0.969256 * x + 1.875991 * y + 0.041556 * z) * 255 + 0.5);
    out[p + 2] = Math.floor(gamma(0.055648 * x - 0.204043 * y + 1.057311 * z) * 255 + 0.5);
    out[p + 3] = rgba[p + 3];
  }
}

// guided_filter(L, A／B, r, eps)：兩個顏色通道共用導引 L 的平均和變異數
function guidedChroma(I, chans, outs, w, h, r, eps, s) {
  const n = I.length, mI = s.get(0), vI = s.get(1), mP = s.get(2), c = s.get(3);
  box(I, mI, w, h, r, s);
  for (let i = 0; i < n; i++) c[i] = I[i] * I[i];
  box(c, vI, w, h, r, s);
  for (let i = 0; i < n; i++) vI[i] -= mI[i] * mI[i];
  for (let k = 0; k < chans.length; k++) {
    const p = chans[k], out = outs[k];
    box(p, mP, w, h, r, s);
    for (let i = 0; i < n; i++) c[i] = I[i] * p[i];
    box(c, c, w, h, r, s);
    for (let i = 0; i < n; i++) {  // c 變成 a，mP 變成 b
      const a = (c[i] - mI[i] * mP[i]) / (vI[i] + eps);
      c[i] = a;
      mP[i] -= a * mI[i];
    }
    box(c, c, w, h, r, s);
    box(mP, out, w, h, r, s);
    for (let i = 0; i < n; i++) out[i] += c[i] * I[i];
  }
}

// reduce_blotches 裡和遮罩、強度無關的部分：mid = g - guided_filter(g, g, 10, 9)，g 是輕微模糊的亮度
function blotchDetail(L, mid, w, h, s) {
  const n = L.length, g = gauss(L, mid, w, h, 1.5, s), mI = s.get(0), v = s.get(1), mB = s.get(2);
  box(g, mI, w, h, BLOTCH_R, s);
  for (let i = 0; i < n; i++) v[i] = g[i] * g[i];
  box(v, v, w, h, BLOTCH_R, s);
  for (let i = 0; i < n; i++) {  // v 變成 a，mI 變成 b
    const m = mI[i], vi = v[i] - m * m, a = vi / (vi + BLOTCH_EPS);
    v[i] = a;
    mI[i] = m - a * m;
  }
  box(v, v, w, h, BLOTCH_R, s);
  box(mI, mB, w, h, BLOTCH_R, s);
  for (let i = 0; i < n; i++) mid[i] = g[i] - (v[i] * g[i] + mB[i]);
}

// skin_mask：暖色（色相 0～90 度）、中等飽和、中等亮度的地方，再模糊讓邊緣柔和
const smooth = (lo, hi, x) => {
  const t = x <= lo ? 0 : x >= hi ? 1 : (x - lo) / (hi - lo);
  return t * t * (3 - 2 * t);
};
function skinMask(L, A, B, out, w, h, s) {
  const DEG = 180 / Math.PI;
  for (let i = 0; i < L.length; i++) {
    const a = A[i], b = B[i], hue = Math.atan2(b, a) * DEG;
    out[i] = smooth(5, 9, Math.sqrt(a * a + b * b)) * smooth(30, 45, L[i]) * smooth(-10, 10, hue) * (1 - smooth(80, 100, hue));
  }
  return gauss(out, out, w, h, 4, s);
}

/* ── 診斷檢視 ─────────────────────────────────────────────── */

export const CHROMA_GAIN = 4;     // 「只看顏色」：顏色放大的倍數
export const CHROMA_L = 60;       // 「只看顏色」：亮度一律拉成這個值
export const HEAT_MAX = 6;        // 「改變幅度」：ΔE 到這個值就是色階最亮的一端

// 「只看顏色」：亮度固定、a／b 放大，斑駁的色塊和彩色顆粒會變得很明顯。超出色域的照 gamma() 夾住
function chromaView(A, B, rgba, out) {
  const fy = (CHROMA_L + 16) / 116, y = fy * fy * fy;
  for (let i = 0, p = 0; i < A.length; i++, p += 4) {
    let fx = A[i] * CHROMA_GAIN / 500 + fy, fz = fy - B[i] * CHROMA_GAIN / 200;
    fx = fx <= F_T ? (fx - F16) / 7.787 : fx * fx * fx;
    fz = fz <= F_T ? (fz - F16) / 7.787 : fz * fz * fz;
    const x = fx * 0.950456, z = fz * 1.088754;
    out[p] = Math.floor(gamma(3.240479 * x - 1.53715 * y - 0.498535 * z) * 255 + 0.5);
    out[p + 1] = Math.floor(gamma(-0.969256 * x + 1.875991 * y + 0.041556 * z) * 255 + 0.5);
    out[p + 2] = Math.floor(gamma(0.055648 * x - 0.204043 * y + 1.057311 * z) * 255 + 0.5);
    out[p + 3] = rgba[p + 3];
  }
}

// 熱圖色階（近似 inferno：黑 → 紫 → 紅 → 橘 → 淡黃），疊在調暗的灰階原圖上
const HEAT_STOPS = [
  [0, 0, 0, 4],
  [0.25, 87, 16, 110],
  [0.5, 188, 55, 84],
  [0.75, 249, 142, 9],
  [1, 252, 255, 164],
];
const HEAT_LUT = new Uint8Array(256 * 3);
for (let i = 0; i < 256; i++) {
  const t = i / 255;
  let k = 0;
  while (k < HEAT_STOPS.length - 2 && t > HEAT_STOPS[k + 1][0]) k++;
  const [t0, r0, g0, b0] = HEAT_STOPS[k], [t1, r1, g1, b1] = HEAT_STOPS[k + 1], u = (t - t0) / (t1 - t0);
  HEAT_LUT[i * 3] = Math.round(r0 + (r1 - r0) * u);
  HEAT_LUT[i * 3 + 1] = Math.round(g0 + (g1 - g0) * u);
  HEAT_LUT[i * 3 + 2] = Math.round(b0 + (b1 - b0) * u);
}
export const HEAT_CSS = HEAT_STOPS.map(([t, r, g, b]) => `rgb(${r} ${g} ${b}) ${t * 100}%`).join(', ');

const BASE_DIM = 0.35;  // 熱圖和膚色範圍底下那張灰階原圖的亮度

// 「改變幅度」：每個像素降噪前後的 ΔE（CIE76：L、a、b 的直線距離）
function diffView(L, A, B, L2, A2, B2, rgba, out) {
  for (let i = 0, p = 0; i < L.length; i++, p += 4) {
    const dL = L2[i] - L[i], da = A2[i] - A[i], db = B2[i] - B[i];
    const t = Math.min(1, Math.sqrt(dL * dL + da * da + db * db) / HEAT_MAX), q = Math.round(t * 255) * 3;
    const base = L[i] * 2.55 * BASE_DIM, alpha = Math.min(1, t * 1.6);
    out[p] = base + (HEAT_LUT[q] - base) * alpha;
    out[p + 1] = base + (HEAT_LUT[q + 1] - base) * alpha;
    out[p + 2] = base + (HEAT_LUT[q + 2] - base) * alpha;
    out[p + 3] = rgba[p + 3];
  }
}

// 「膚色範圍」：膚色均勻會作用的地方染成靛藍（本站的 accent #94a9e6），其餘是調暗的灰階原圖
const TINT = [148, 169, 230], TINT_MAX = 0.85;
function maskView(L, mask, rgba, out) {
  for (let i = 0, p = 0; i < L.length; i++, p += 4) {
    const base = L[i] * 2.55 * BASE_DIM, m = mask[i] * TINT_MAX;
    out[p] = base + (TINT[0] - base) * m;
    out[p + 1] = base + (TINT[1] - base) * m;
    out[p + 2] = base + (TINT[2] - base) * m;
    out[p + 3] = rgba[p + 3];
  }
}

/* ── 色雜訊等級 ───────────────────────────────────────────── */

const GRADE_F = 4;            // 先縮小 4 倍（4×4 平均）：一兩個像素的細顆粒肉眼看不出顏色，留下 4 像素以上的色斑
const GRADE_SIGMA = 2.5;      // 帶通：減掉 σ 2.5 的模糊（原圖約 10 像素），漸層和大面積的顏色變化不算
const GRADE_R = 3;            // 視窗 7×7（原圖約 28 像素）
const GRADE_FLAT = 1.5;       // 視窗裡亮度的起伏超過這個值就不算：有紋理或邊緣，顏色變化多半是畫面本身
const GRADE_MIN = 0.003;      // 平滑的視窗至少要占 0.3%（而且至少 12 個），不夠就放寬亮度範圍，再不夠就無法判斷
const GRADE_GAIN = 1.25;      // 中位數 → 色差幅度：在乾淨的圖上加已知幅度的人工色斑，量出來約是 0.8 倍
const GRADE_RANGES = [[30, 97], [20, 99]];  // 先只看中間調；太暗、太亮的地方色雜訊不明顯，不夠時才放寬

/**
 * 色雜訊指數：在亮度平滑的地方（皮膚、天空、牆面），量「和亮度無關的顏色起伏」的典型大小，單位大約是 ΔE。
 * 1. 轉 Lab 並縮小 4 倍；帶通去掉漸層。
 * 2. 每個 7×7 視窗把顏色對亮度做線性回歸，扣掉跟著亮度走的部分（陰影、紋理本身的顏色），剩下的就是色雜訊。
 * 3. 只留亮度平滑、不透明、亮度在中間調的視窗，取中位數再乘校準係數。
 * 水彩、做舊的筆觸本身就有和亮度無關的顏色紋理，分數會偏高一些。
 * @param {Uint8ClampedArray} rgba
 * @param {number} w
 * @param {number} h
 * @returns {{ score: number | null, coverage: number, basis: 'mid' | 'wide' | null }}  score 是 null 表示無法判斷
 */
export function measureNoise(rgba, w, h) {
  const F = GRADE_F, W = Math.floor(w / F), H = Math.floor(h / F), m = W * H, R = GRADE_R;
  const margin = R + Math.ceil(GRADE_SIGMA * 2);
  const none = { score: null, coverage: 0, basis: null };
  if (W < margin * 2 + 8 || H < margin * 2 + 8) return none;

  // Lab 的 4×4 平均；有任何一點不完全不透明的格子記下來，含它的視窗不算
  const L = new Float32Array(m), A = new Float32Array(m), B = new Float32Array(m), solid = new Float32Array(m);
  const inv = 1 / (F * F);
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      let sl = 0, sa = 0, sb = 0, op = 1;
      for (let j = 0; j < F; j++) {
        let p = ((Y * F + j) * w + X * F) * 4;
        for (let i = 0; i < F; i++, p += 4) {
          const r = LIN[rgba[p]], g = LIN[rgba[p + 1]], b = LIN[rgba[p + 2]];
          const fx = fLab((0.412453 * r + 0.357580 * g + 0.180423 * b) / 0.950456);
          const yy = 0.212671 * r + 0.715160 * g + 0.072169 * b, fy = fLab(yy);
          const fz = fLab((0.019334 * r + 0.119193 * g + 0.950227 * b) / 1.088754);
          sl += yy > T ? 116 * fy - 16 : 903.3 * yy;
          sa += 500 * (fx - fy);
          sb += 200 * (fy - fz);
          if (rgba[p + 3] < 255) op = 0;
        }
      }
      const k = Y * W + X;
      L[k] = sl * inv; A[k] = sa * inv; B[k] = sb * inv; solid[k] = op;
    }
  }

  const s = { tmp: new Float32Array(m), acc: new Float64Array(W) };
  const f = () => new Float32Array(m);
  const dL = gauss(L, f(), W, H, GRADE_SIGMA, s), dA = gauss(A, f(), W, H, GRADE_SIGMA, s), dB = gauss(B, f(), W, H, GRADE_SIGMA, s);
  for (let i = 0; i < m; i++) { dL[i] = L[i] - dL[i]; dA[i] = A[i] - dA[i]; dB[i] = B[i] - dB[i]; }
  const mean = (src) => box(src, f(), W, H, R, s);
  const meanOf = (x, y) => { const o = f(); for (let i = 0; i < m; i++) o[i] = x[i] * y[i]; return box(o, o, W, H, R, s); };
  const mL = mean(dL), mA = mean(dA), mB = mean(dB), mLum = mean(L), mSolid = mean(solid);
  const mLL = meanOf(dL, dL), mAA = meanOf(dA, dA), mBB = meanOf(dB, dB), mLA = meanOf(dL, dA), mLB = meanOf(dL, dB);

  const picks = GRADE_RANGES.map(() => []);
  let total = 0;
  for (let y = margin; y < H - margin; y += 2) {
    for (let x = margin; x < W - margin; x += 2) {
      total++;
      const i = y * W + x, vL = mLL[i] - mL[i] * mL[i];
      if (mSolid[i] < 0.999 || vL < 1e-4 || vL > GRADE_FLAT * GRADE_FLAT) continue;
      const lum = mLum[i];
      if (lum < GRADE_RANGES[GRADE_RANGES.length - 1][0] || lum > GRADE_RANGES[GRADE_RANGES.length - 1][1]) continue;
      const cA = mLA[i] - mL[i] * mA[i], cB = mLB[i] - mL[i] * mB[i], d = vL + 0.01;
      const rA = Math.max(0, mAA[i] - mA[i] * mA[i] - cA * cA / d), rB = Math.max(0, mBB[i] - mB[i] * mB[i] - cB * cB / d);
      const v = Math.sqrt(rA + rB);
      for (let k = 0; k < GRADE_RANGES.length; k++) if (lum >= GRADE_RANGES[k][0] && lum <= GRADE_RANGES[k][1]) picks[k].push(v);
    }
  }
  const need = Math.max(12, total * GRADE_MIN);
  for (let k = 0; k < picks.length; k++) {
    const vals = picks[k];
    if (vals.length < need) continue;
    vals.sort((a, b) => a - b);
    return { score: vals[vals.length >> 1] * GRADE_GAIN, coverage: vals.length / total, basis: k === 0 ? 'mid' : 'wide' };
  }
  return { ...none, coverage: picks[picks.length - 1].length / total };
}

/**
 * 一張圖的降噪器：Lab、色彩降噪的結果（照半徑）、膚色均勻的細節和遮罩都留著，拉滑桿重算時只算變了的部分。
 * @param {Uint8ClampedArray} rgba  原圖的 RGBA（會被留著當透明度的來源，不要再改它）
 * @param {number} w
 * @param {number} h
 */
export function createDenoiser(rgba, w, h) {
  const n = w * h, f = () => new Float32Array(n), scratch = [];
  const s = { tmp: f(), acc: new Float64Array(w), get: i => scratch[i] || (scratch[i] = f()) };
  const L = f(), A = f(), B = f();
  toLab(rgba, L, A, B);
  let radius = -1, A2 = A, B2 = B, mid = null, mask = null, maskRadius = -1, Lb = null, Lout = L;

  // 膚色遮罩照目前半徑的顏色算；半徑變了才重算
  function ensureMask() {
    if (maskRadius !== radius) {
      skinMask(L, A2, B2, mask = mask || f(), w, h, s);
      maskRadius = radius;
    }
    return mask;
  }

  return {
    width: w, height: h,
    /**
     * @param {number} r       色彩平滑半徑（像素，0 是不做）
     * @param {number} blotch  膚色均勻 0..1（0 是不做）
     * @returns {Uint8ClampedArray} RGBA
     */
    run(r, blotch) {
      r = Math.max(0, Math.round(r) || 0);
      blotch = Math.min(1, Math.max(0, Number(blotch) || 0));
      if (r !== radius) {
        if (r === 0) { A2 = A; B2 = B; } else {
          if (A2 === A) { A2 = f(); B2 = f(); }
          guidedChroma(L, [A, B], [A2, B2], w, h, r, EPS, s);
        }
        radius = r;
      }
      Lout = L;
      if (blotch > 0) {
        if (!mid) blotchDetail(L, mid = f(), w, h, s);
        ensureMask();
        Lout = Lb = Lb || f();
        for (let i = 0; i < n; i++) Lout[i] = L[i] - blotch * mid[i] * mask[i];
      }
      const out = new Uint8ClampedArray(n * 4);
      fromLab(Lout, A2, B2, rgba, out);
      return out;
    },
    /**
     * 診斷檢視，照最近一次 run() 的設定。還沒 run 過時，「降噪後」就是原圖。
     * @param {'chroma-before'|'chroma-after'|'diff'|'mask'} name
     * @returns {Uint8ClampedArray} RGBA
     */
    layer(name) {
      const out = new Uint8ClampedArray(n * 4);
      if (name === 'chroma-before') chromaView(A, B, rgba, out);
      else if (name === 'chroma-after') chromaView(A2, B2, rgba, out);
      else if (name === 'diff') diffView(L, A, B, Lout, A2, B2, rgba, out);
      else if (name === 'mask') {
        if (radius < 0) radius = 0;  // 還沒 run 過：照原圖的顏色算
        maskView(L, ensureMask(), rgba, out);
      } else throw new Error('不認得的檢視：' + name);
      return out;
    },
  };
}

export { EPS };
