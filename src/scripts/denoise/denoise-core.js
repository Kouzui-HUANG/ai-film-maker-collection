/**
 * denoise-core.js — AI 圖片色雜訊降噪的計算核心（純函式：沒有 DOM、沒有網路）
 *
 * denoise.worker.js 在 Web Worker 裡呼叫，畫面不會卡住；Node 也能 import（驗證用）。
 *
 * 1. 色雜訊（radius > 0）：轉成 Lab，只把顏色 a、b 用 guided filter（He et al., 2010）
 *    照著 L 的邊緣抹平，嘴唇的粉紅、頭髮的黑不會滲到皮膚。
 * 2. 膚色均勻（blotch > 0）：亮度先輕微模糊（毛孔、髮絲這種 2 像素以下的細節留在原圖，不動），再用 guided filter
 *    只把對比低、中等大小的不均勻拉回周圍的亮度；有真正對比的五官（眼睛、鼻孔、唇線、下巴）保留，
 *    膚色遮罩（暖色、中等飽和、中等亮度）讓頭髮、衣服、背景不受影響。
 * 3. 診斷檢視（layer）：只看顏色（亮度拉平、顏色放大）、改變幅度（ΔE 熱圖）、膚色範圍（遮罩）。
 * 4. 色雜訊指數（measureNoise）：平滑區域裡和亮度無關的顏色起伏，換成 1～5 級的門檻在 grades.js。
 * 5. 亮度斑駁（mottle > 0）：保邊平滑 → 保留大幅度的輪廓 → 方向一致的紋理（木紋、布紋）拉回原圖 → 亮度分布對回原圖；
 *    顏色改用新的亮度當導引。演算法說明在下方「亮度斑駁」一節。
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

/* ── 亮度斑駁 ─────────────────────────────────────────────── */
// AI 圖常見的「髒」多半在亮度：牆面、天空、暗部裡一塊一塊、沒有方向的中等大小亮暗斑。
// 1. 平滑底：domain transform 遞迴濾波（Gastal & Oliveira 2011，線性時間的保邊平滑）跑兩次，再 G(1.2)。
// 2. 保留結構：殘差 r = 原圖 − 平滑底，|r| 大的是輪廓（葉子、縫、字）留著，|r| 小的是斑駁壓掉。
// 3. 紋理保護：結構張量量「方向一致性」，木紋、布紋、髮絲這種朝同一方向的紋理拉回原圖。
// 4. 亮度分位數對回原圖：黑位、高光、整體明暗不變，不會蒙上一層霧。
// 顏色接著用新的亮度當導引做 guided filter，跟著亮斑走的冷暖色斑也一起抹掉。

const MOTTLE_SS = 6;          // 平滑底的空間範圍（像素）
const COH_EPS = 0.002;        // 方向一致性：梯度太弱的地方不算有方向
const COH_BP = 6;             // 量方向前先減掉 G(6)，大範圍的明暗漸層（天空、打光）不算方向
const QM_BINS = 1024, QM_LO = -1, QM_HI = 101;

/** 強度 0..1 → 平滑底的 σr（L 單位）、保留結構的門檻 T、壓掉的比例 */
const mottleParams = (s) => ({ sigmaR: 4 + 10 * s, core: 1 + 4 * s, depth: 0.85 * Math.min(1, 2 * s) });
/** 紋理保護 0..1 → 方向一致性的保護區間 [c0, c1] 和拉回原圖的上限 */
const protectParams = (p) => ({ c0: 0.3 - 0.18 * p, c1: 0.55 - 0.23 * p, keep: Math.min(1, 2 * p) });

// 3 次方框平均近似高斯（Kovesi 的半徑組合，誤差很小），和 σ 大小無關都是線性時間
function fastGauss(src, dst, w, h, sigma, s) {
  const wIdeal = Math.sqrt(12 * sigma * sigma / 3 + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4));
  let cur = src;
  for (let k = 0; k < 3; k++) {
    const r = ((k < m ? wl : wl + 2) - 1) / 2;
    if (r > 0) { box(cur, dst, w, h, r, s); cur = dst; }
  }
  if (cur !== dst) dst.set(cur);
  return dst;
}

// domain transform 遞迴濾波（RF），導引 = 輸入本身；src 和 dst 不能是同一個
function domainTransform(src, dst, w, h, sigmaS, sigmaR, iters = 3) {
  dst.set(src);
  const ratio = sigmaS / sigmaR, Q = 32, NQ = 100 * Q + 1, lut = new Float32Array(NQ);
  for (let k = 0; k < iters; k++) {
    const sH = sigmaS * Math.sqrt(3) * Math.pow(2, iters - k - 1) / Math.sqrt(Math.pow(4, iters) - 1);
    const a = Math.exp(-Math.SQRT2 / sH), la = Math.log(a);
    for (let q = 0; q < NQ; q++) lut[q] = a * Math.exp(la * ratio * q / Q);  // a^(1 + σs/σr·|ΔI|)
    const wt = (d) => lut[Math.min(NQ - 1, (d < 0 ? -d : d) * Q | 0)];
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 1; x < w; x++) { const i = o + x; dst[i] += wt(src[i] - src[i - 1]) * (dst[i - 1] - dst[i]); }
      for (let x = w - 2; x >= 0; x--) { const i = o + x; dst[i] += wt(src[i + 1] - src[i]) * (dst[i + 1] - dst[i]); }
    }
    for (let y = 1; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) { const i = o + x; dst[i] += wt(src[i] - src[i - w]) * (dst[i - w] - dst[i]); }
    }
    for (let y = h - 2; y >= 0; y--) {
      const o = y * w;
      for (let x = 0; x < w; x++) { const i = o + x; dst[i] += wt(src[i + w] - src[i]) * (dst[i + w] - dst[i]); }
    }
  }
  return dst;
}

// 方向一致性（0 是沒有方向的團塊，1 是同一方向的線），在半解析度算、存半解析度
// 小窗：梯度 σ1、積分 σ8 的結構張量；大範圍：小窗的方向向量（雙倍角 × 一致性）再平均 σ12，兩者取大。
// 小窗先正規化，牆柱的邊緣不會壓過一整片木頭。
function coherenceMap(L, w, h, s) {
  const n = w * h, g = gauss(L, s.get(0), w, h, 1.0, s), lo = fastGauss(L, s.get(1), w, h, COH_BP, s);
  for (let i = 0; i < n; i++) g[i] -= lo[i];
  const W = (w + 1) >> 1, H = (h + 1) >> 1, m = W * H;
  const xx = new Float32Array(m), yy = new Float32Array(m), xy = new Float32Array(m), cnt = new Float32Array(m);
  for (let y = 0; y < h; y++) {
    const ym = y > 0 ? y - 1 : 0, yp = y < h - 1 ? y + 1 : h - 1, row = (y >> 1) * W;
    for (let x = 0; x < w; x++) {
      const gx = 0.5 * (g[y * w + (x < w - 1 ? x + 1 : x)] - g[y * w + (x > 0 ? x - 1 : 0)]);
      const gy = 0.5 * (g[yp * w + x] - g[ym * w + x]);
      const j = row + (x >> 1);
      xx[j] += gx * gx; yy[j] += gy * gy; xy[j] += gx * gy; cnt[j]++;
    }
  }
  for (let j = 0; j < m; j++) { const c = 1 / cnt[j]; xx[j] *= c; yy[j] *= c; xy[j] *= c; }
  const hs = { tmp: new Float32Array(m), acc: new Float64Array(W) };
  fastGauss(xx, xx, W, H, 4, hs);
  fastGauss(yy, yy, W, H, 4, hs);
  fastGauss(xy, xy, W, H, 4, hs);
  const coh = cnt;  // 重用
  for (let j = 0; j < m; j++) {
    const tr = xx[j] + yy[j] + COH_EPS, dxy = xx[j] - yy[j], d = Math.sqrt(dxy * dxy + 4 * xy[j] * xy[j]) / tr;
    coh[j] = d * d;
    xx[j] = dxy / tr; yy[j] = 2 * xy[j] / tr;  // 方向向量（雙倍角），長度 = √一致性
  }
  fastGauss(xx, xx, W, H, 6, hs);
  fastGauss(yy, yy, W, H, 6, hs);
  for (let j = 0; j < m; j++) { const r = xx[j] * xx[j] + yy[j] * yy[j]; if (r > coh[j]) coh[j] = r; }
  return { coh, W, H };
}

// 亮度累積分布（QM_BINS 格），給分位數對應用
function lumCdf(L) {
  const c = new Float64Array(QM_BINS), sc = QM_BINS / (QM_HI - QM_LO);
  for (let i = 0; i < L.length; i++) c[Math.min(QM_BINS - 1, Math.max(0, Math.floor((L[i] - QM_LO) * sc)))]++;
  for (let i = 1; i < QM_BINS; i++) c[i] += c[i - 1];
  for (let i = 0; i < QM_BINS; i++) c[i] /= L.length;
  return c;
}
// 把 X 的分布對回參考分布（原地改寫）
function quantileMatch(X, refCdf) {
  const sc = QM_BINS / (QM_HI - QM_LO), cs = lumCdf(X), map = new Float32Array(QM_BINS);
  for (let i = 0, j = 0; i < QM_BINS; i++) {
    while (j < QM_BINS - 1 && refCdf[j] < cs[i]) j++;
    map[i] = QM_LO + (j + 0.5) / sc;
  }
  for (let i = 0; i < X.length; i++) {
    const t = (X[i] - QM_LO) * sc, b = Math.min(QM_BINS - 2, Math.max(0, Math.floor(t))), f = Math.min(1, Math.max(0, t - b));
    X[i] = map[b] * (1 - f) + map[b + 1] * f;
  }
  return X;
}

// 平滑底 + 保留結構（照強度），結果寫進 out
function mottleBase(L, out, w, h, strength, s) {
  const n = w * h, { sigmaR, core, depth } = mottleParams(strength), t = s.get(0);
  domainTransform(L, t, w, h, MOTTLE_SS, sigmaR);
  domainTransform(t, out, w, h, MOTTLE_SS, sigmaR);
  gauss(out, t, w, h, 1.2, s);
  const k = -1 / (2 * core * core);
  for (let i = 0; i < n; i++) { const r = L[i] - t[i]; out[i] = t[i] + r * (1 - depth * Math.exp(r * r * k)); }
  return out;
}

// 紋理保護：方向一致的地方把 base 拉回原圖，寫進 out，再把亮度分布對回原圖
function protectBlend(L, base, out, cohMap, w, h, protect, refCdf) {
  const { c0, c1, keep } = protectParams(protect);
  if (keep <= 0) { out.set(base); return quantileMatch(out, refCdf); }
  const { coh, W, H } = cohMap, m = W * H, P = new Float32Array(m), hs = { tmp: new Float32Array(m), acc: new Float64Array(W) };
  for (let j = 0; j < m; j++) P[j] = keep * smooth(c0, c1, coh[j]);
  fastGauss(P, P, W, H, 2, hs);  // 讓保護在整片木頭裡連成一片
  for (let y = 0; y < h; y++) {   // 半解析度 → 原尺寸：雙線性
    const fy = Math.min(H - 1, Math.max(0, (y - 0.5) / 2)), y0 = Math.floor(fy), y1 = Math.min(H - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(W - 1, Math.max(0, (x - 0.5) / 2)), x0 = Math.floor(fx), x1 = Math.min(W - 1, x0 + 1), tx = fx - x0;
      const p = (P[y0 * W + x0] * (1 - tx) + P[y0 * W + x1] * tx) * (1 - ty) + (P[y1 * W + x0] * (1 - tx) + P[y1 * W + x1] * tx) * ty;
      const i = y * w + x;
      out[i] = base[i] + p * (L[i] - base[i]);
    }
  }
  return quantileMatch(out, refCdf);
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
 * 一張圖的降噪器：Lab、色彩降噪的結果（照半徑與導引）、亮度斑駁的中間結果、膚色均勻的細節和遮罩都留著，
 * 拉滑桿重算時只算變了的部分。亮度斑駁是 0 時，輸出和沒有這個功能之前逐位元相同。
 * @param {Uint8ClampedArray} rgba  原圖的 RGBA（會被留著當透明度的來源，不要再改它）
 * @param {number} w
 * @param {number} h
 */
export function createDenoiser(rgba, w, h) {
  const n = w * h, f = () => new Float32Array(n), scratch = [];
  const s = { tmp: f(), acc: new Float64Array(w), get: i => scratch[i] || (scratch[i] = f()) };
  const L = f(), A = f(), B = f();
  toLab(rgba, L, A, B);
  let chromaKey = null, A2 = A, B2 = B, mid = null, mask = null, maskKey = null, Lb = null, Lout = L;
  // 亮度斑駁：平滑底照強度快取，方向一致性和原圖的亮度分布只算一次，保護後的亮度照（強度, 保護）快取
  let mBase = null, mBaseS = -1, coh = null, cdf = null, Lm = null, lmKey = null;

  // 膚色遮罩照目前的顏色算；顏色變了才重算
  function ensureMask() {
    if (maskKey !== chromaKey) {
      skinMask(L, A2, B2, mask = mask || f(), w, h, s);
      maskKey = chromaKey;
    }
    return mask;
  }

  return {
    width: w, height: h,
    /**
     * @param {number} r        色彩平滑半徑（像素，0 是不做）
     * @param {number} blotch   膚色均勻 0..1（0 是不做）
     * @param {number} [mottle] 亮度斑駁 0..1（0 是不做）
     * @param {number} [protect] 紋理保護 0..1（亮度斑駁開著才有作用）
     * @returns {Uint8ClampedArray} RGBA
     */
    run(r, blotch, mottle = 0, protect = 0) {
      r = Math.max(0, Math.round(r) || 0);
      blotch = Math.min(1, Math.max(0, Number(blotch) || 0));
      mottle = Math.min(1, Math.max(0, Number(mottle) || 0));
      protect = Math.min(1, Math.max(0, Number(protect) || 0));

      // 1. 亮度斑駁：Lg 是之後顏色導引和膚色均勻的底
      let Lg = L, gKey = '';
      if (mottle > 0) {
        if (mBaseS !== mottle) { mottleBase(L, mBase = mBase || f(), w, h, mottle, s); mBaseS = mottle; }
        gKey = mottle + ':' + protect;
        if (lmKey !== gKey) {
          if (!cdf) cdf = lumCdf(L);
          if (!coh && protectParams(protect).keep > 0) coh = coherenceMap(L, w, h, s);
          protectBlend(L, mBase, Lm = Lm || f(), coh, w, h, protect, cdf);
          lmKey = gKey;
        }
        Lg = Lm;
      }

      // 2. 色雜訊：照 Lg 的邊緣抹平 a/b
      const key = r + '|' + gKey;
      if (key !== chromaKey) {
        if (r === 0) { A2 = A; B2 = B; } else {
          if (A2 === A) { A2 = f(); B2 = f(); }
          guidedChroma(Lg, [A, B], [A2, B2], w, h, r, EPS, s);
        }
        chromaKey = key;
      }

      // 3. 膚色均勻
      Lout = Lg;
      if (blotch > 0) {
        if (!mid) blotchDetail(L, mid = f(), w, h, s);
        ensureMask();
        Lout = Lb = Lb || f();
        for (let i = 0; i < n; i++) Lout[i] = Lg[i] - blotch * mid[i] * mask[i];
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
        if (chromaKey === null) chromaKey = '0|';  // 還沒 run 過：照原圖的顏色算
        maskView(L, ensureMask(), rgba, out);
      } else throw new Error('不認得的檢視：' + name);
      return out;
    },
  };
}

export { EPS };
