/**
 * AI 影片算力成本試算器：公式、模型單價快照、預設情境、格式化與網址參數
 *
 * 依據〈AI影片製作費用怎麼估？人力、抽卡、修改與後製成本〉（/post/ai-video-production-cost/）：
 *   需要生成的秒數＝成片秒數 ÷ 採用率
 *   含修改預備量的生成秒數＝需要生成的秒數 ×（1＋修改率）
 *   模型費＝含修改預備量的生成秒數 × 模型每秒單價（四捨五入至元）
 *   人力費＝人日單價 × 人日數
 *   試算總價＝模型費＋人力費
 *
 * 頁面 frontmatter（SSR 初值、情境表）與前端 <script>（拉桿即時試算）共用這一份，
 * 所以只能放純資料與純函式：不可 import astro:*、node 模組或任何會碰到 DOM 的東西。
 */

/** 模型單價的資料日（文章依編輯部提供的 Dreamina 國際版方案換算） */
export const PRICE_DATE = '2026-09-15';

/** 公式與情境出處（posts 的 urlSlug） */
export const SOURCE_POST_SLUG = 'ai-video-production-cost';

export type Model = { id: string; name: string; res: string; price: number };

export const MODELS: readonly Model[] = [
  { id: 'seedance2-720p', name: 'Seedance 2', res: '720p', price: 5.7 },
  { id: 'seedance2-1080p', name: 'Seedance 2', res: '1080p', price: 11 },
  { id: 'seedance25-720p', name: 'Seedance 2.5', res: '720p', price: 8.7 },
  { id: 'seedance25-1080p', name: 'Seedance 2.5', res: '1080p', price: 21.3 },
];

export const CUSTOM_MODEL = 'custom';

export function modelById(id: string): Model | undefined {
  return MODELS.find((m) => m.id === id);
}

export type Params = {
  /** 單集長度（秒） */
  len: number;
  /** 集數 */
  eps: number;
  /** 採用率（%）：最後進入成片的秒數占全部生成秒數的比例 */
  adopt: number;
  /** 修改預備量（%） */
  rev: number;
  /** MODELS[].id 或 'custom' */
  model: string;
  /** 每生成秒單價（元） */
  price: number;
  /** 是否計入人力費 */
  labor: boolean;
  /** 人日單價（元） */
  rate: number;
  /** 人日數 */
  days: number;
};

export type Preset = {
  id: string;
  /** 文章裡的情境代號 */
  key: string;
  label: string;
  /** 卡片上的一行說明 */
  summary: string;
  params: Params;
};

/** 四個情境的參數逐項照文章，試算結果也必須與文章一致（10,513／61,880／94,800／3,528,000 元） */
export const PRESETS: readonly Preset[] = [
  {
    id: 'social',
    key: 'A',
    label: '30 秒社群短片',
    summary: '直式社群內容，初階執行者',
    params: { len: 30, eps: 1, adopt: 40, rev: 20, model: 'seedance2-720p', price: 5.7, labor: true, rate: 2000, days: 5 },
  },
  {
    id: 'brand',
    key: 'B',
    label: '3 分鐘品牌短劇',
    summary: '大螢幕播放，中階執行者',
    params: { len: 180, eps: 1, adopt: 20, rev: 20, model: 'seedance2-1080p', price: 11, labor: true, rate: 5000, days: 10 },
  },
  {
    id: 'series',
    key: 'C',
    label: '10 集網路短劇',
    summary: '每集 1 分鐘，角色與場景重用',
    params: { len: 60, eps: 10, adopt: 40, rev: 20, model: 'seedance2-1080p', price: 11, labor: true, rate: 5000, days: 15 },
  },
  {
    id: 'feature',
    key: 'D',
    label: '100 分鐘 AI 電影',
    summary: '採用率 10%，不加修改預備量',
    params: { len: 6000, eps: 1, adopt: 10, rev: 0, model: 'seedance25-1080p', price: 21.3, labor: true, rate: 5000, days: 450 },
  },
];

export const DEFAULT_PRESET_ID = 'brand';

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function defaultParams(): Params {
  return { ...presetById(DEFAULT_PRESET_ID)!.params };
}

/* ── 欄位：數字框的合法範圍與拉桿的常用範圍 ──────────────────────────
 * 拉桿只涵蓋常用範圍，數字框可以填得更遠（拉桿停在端點）。
 * steps：跨好幾個數量級的欄位（片長、集數、人日）用階梯值，拉桿走的是索引，
 *        否則 5 秒到 3 小時擠在同一條線上，短片幾乎拉不到。 */
export type NumField = 'len' | 'eps' | 'adopt' | 'rev' | 'price' | 'rate' | 'days';

export type FieldSpec = {
  min: number;
  max: number;
  /** 數字框接受的小數位數 */
  decimals: number;
  /** 直線拉桿的範圍與間距（沒有 steps 時用） */
  slider?: { min: number; max: number; step: number };
  /** 階梯拉桿的刻度值（由小到大） */
  steps?: readonly number[];
};

export const FIELDS: Record<NumField, FieldSpec> = {
  len: {
    min: 1,
    max: 36000,
    decimals: 0,
    steps: [
      5, 10, 15, 20, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600, 900, 1200, 1500, 1800,
      2400, 3000, 3600, 4500, 5400, 6000, 7200, 9000, 10800,
    ],
  },
  eps: {
    min: 1,
    max: 999,
    decimals: 0,
    steps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 16, 20, 24, 25, 30, 40, 50, 60, 80, 100],
  },
  adopt: { min: 1, max: 100, decimals: 0, slider: { min: 1, max: 100, step: 1 } },
  rev: { min: 0, max: 300, decimals: 0, slider: { min: 0, max: 100, step: 5 } },
  price: { min: 0.1, max: 500, decimals: 2, slider: { min: 0.5, max: 50, step: 0.1 } },
  rate: { min: 0, max: 100000, decimals: 0, slider: { min: 500, max: 15000, step: 100 } },
  days: {
    min: 0,
    max: 10000,
    decimals: 1,
    steps: [
      0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 18, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150,
      200, 250, 300, 350, 400, 450, 500, 600, 800, 1000,
    ],
  },
};

/** 夾在合法範圍內並取到該欄的小數位數；非數字回傳 null */
export function normalize(field: NumField, raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(n) || String(raw ?? '').trim() === '') return null;
  const spec = FIELDS[field];
  const k = 10 ** spec.decimals;
  return Math.min(spec.max, Math.max(spec.min, Math.round(n * k) / k));
}

/** 階梯拉桿：值 → 最接近的刻度索引 */
export function nearestStep(steps: readonly number[], value: number): number {
  let best = 0;
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(steps[i] - value) < Math.abs(steps[best] - value)) best = i;
  }
  return best;
}

/* ── 試算 ─────────────────────────────────────────────────────── */
export type Result = {
  /** 成片秒數 */
  finalSec: number;
  /** 第一版所需生成量（秒） */
  firstSec: number;
  /** 含修改預備量的生成秒數 */
  genSec: number;
  /** 不會進成片的生成秒數 */
  discardSec: number;
  /** 成片每 1 秒要生成幾秒 */
  ratio: number;
  /** 模型費（算力費，元，已四捨五入） */
  compute: number;
  /** 人力費（元；不計人力時為 0） */
  labor: number;
  total: number;
  /** 算力占總價的比例（0–1）；總價為 0 時 null */
  computeShare: number | null;
  /** 每分鐘成片的算力費與總價 */
  perMinCompute: number;
  perMinTotal: number;
};

export function calc(p: Params): Result {
  const finalSec = p.len * p.eps;
  /* 先乘後除，避免 30 ÷ 0.4 這類浮點誤差 */
  const firstSec = (finalSec * 100) / p.adopt;
  const genSec = (firstSec * (100 + p.rev)) / 100;
  const compute = Math.round(genSec * p.price);
  const labor = p.labor ? Math.round(p.rate * p.days) : 0;
  const total = compute + labor;
  const minutes = finalSec / 60;
  return {
    finalSec,
    firstSec,
    genSec,
    discardSec: genSec - finalSec,
    ratio: (100 + p.rev) / p.adopt,
    compute,
    labor,
    total,
    computeShare: total > 0 ? compute / total : null,
    perMinCompute: Math.round(compute / minutes),
    perMinTotal: Math.round(total / minutes),
  };
}

export function sameParams(a: Params, b: Params): boolean {
  return (
    a.len === b.len &&
    a.eps === b.eps &&
    a.adopt === b.adopt &&
    a.rev === b.rev &&
    a.model === b.model &&
    a.price === b.price &&
    a.labor === b.labor &&
    a.rate === b.rate &&
    a.days === b.days
  );
}

export function matchPreset(p: Params): Preset | undefined {
  return PRESETS.find((pr) => sameParams(pr.params, p));
}

/* ── 格式化（文章體例：千分位、全形＝與＋、半形 × ÷ 前後留空） ── */
export function fmtNum(n: number, maxDecimals = 0): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: maxDecimals });
}

/** 秒數：整數不帶小數，否則留一位 */
export function fmtSec(n: number): string {
  return fmtNum(n, 1);
}

export function fmtPrice(n: number): string {
  return fmtNum(n, 2);
}

export function fmtPct(share: number): string {
  return `${fmtNum(share * 100, 1)}%`;
}

/** 修改預備倍數：20% → 1.2、5% → 1.05、100% → 2 */
export function fmtMultiplier(rev: number): string {
  return fmtNum((100 + rev) / 100, 2);
}

/** 秒數 → 「45 秒」「3 分鐘」「1 分 30 秒」「100 分鐘」「16 小時 40 分」
 *  三小時以內用分鐘：片長習慣講「100 分鐘」，不講「1 小時 40 分」 */
export function fmtDuration(sec: number): string {
  const t = Math.round(sec);
  if (t < 60) return `${fmtSec(sec)} 秒`;
  if (t < 10800) {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return s ? `${m} 分 ${s} 秒` : `${m} 分鐘`;
  }
  const h = Math.floor(t / 3600);
  const m = Math.round((t % 3600) / 60);
  if (m === 60) return `${h + 1} 小時`;
  return m ? `${fmtNum(h)} 小時 ${m} 分` : `${fmtNum(h)} 小時`;
}

/** 一萬以上補「約 N 萬元」；一億以上改用億 */
export function fmtWan(n: number): string | null {
  if (n >= 1e8) return `約 ${fmtNum(n / 1e8, 2)} 億元`;
  if (n >= 1e4) return `約 ${fmtNum(n / 1e4, n >= 1e6 ? 1 : 2)} 萬元`;
  return null;
}

export function modelLabel(p: Params): string {
  const m = modelById(p.model);
  return m ? `${m.name} ${m.res}` : '自訂單價';
}

/** 成片的一句話描述：「3 分鐘」「1 分鐘 × 10 集（共 10 分鐘）」 */
export function fmtFinal(p: Params): string {
  if (p.eps === 1) return fmtDuration(p.len);
  return `${fmtDuration(p.len)} × ${fmtNum(p.eps)} 集（共 ${fmtDuration(p.len * p.eps)}）`;
}

/** 文章體例的算式（每行一個步驟） */
export function formulaLines(p: Params, r: Result = calc(p)): string[] {
  const lines: string[] = [];
  if (p.eps > 1) lines.push(`成片長度：${fmtNum(p.len)} × ${fmtNum(p.eps)} 集＝${fmtNum(r.finalSec)} 秒`);
  lines.push(`第一版所需生成量：${fmtNum(r.finalSec)} ÷ ${p.adopt}%＝${fmtSec(r.firstSec)} 秒`);
  if (p.rev > 0) lines.push(`含修改預備量：${fmtSec(r.firstSec)} × ${fmtMultiplier(p.rev)}＝${fmtSec(r.genSec)} 秒`);
  lines.push(`模型費：${fmtSec(r.genSec)} × ${fmtPrice(p.price)}＝${fmtNum(r.compute)} 元`);
  if (p.labor) {
    lines.push(`人力費：${fmtNum(p.rate)} × ${fmtNum(p.days, 1)}＝${fmtNum(r.labor)} 元`);
    lines.push(`試算總價：${fmtNum(r.compute)}＋${fmtNum(r.labor)}＝${fmtNum(r.total)} 元`);
  } else {
    lines.push(`試算總價：${fmtNum(r.total)} 元（未計人力）`);
  }
  return lines;
}

/** 「複製算式」的完整文字：參數摘要＋算式＋連結 */
export function summaryText(p: Params, url: string, siteName: string): string {
  const r = calc(p);
  const head = [
    `AI 影片算力成本試算（${siteName}）`,
    `成片 ${fmtFinal(p)}，採用率 ${p.adopt}%，修改預備量 ${p.rev}%`,
    `${modelLabel(p)}：每生成秒 ${fmtPrice(p.price)} 元`,
  ];
  return [...head, '', ...formulaLines(p, r), '', url].join('\n');
}

/** 拉桿的 aria-valuetext（階梯拉桿的 value 是索引，讀屏要讀實際值） */
export function valueText(field: NumField, p: Params): string {
  switch (field) {
    case 'len':
      return fmtDuration(p.len);
    case 'eps':
      return `${fmtNum(p.eps)} 集`;
    case 'adopt':
      return `${p.adopt}%`;
    case 'rev':
      return `${p.rev}%`;
    case 'price':
      return `每生成秒 ${fmtPrice(p.price)} 元`;
    case 'rate':
      return `每人日 ${fmtNum(p.rate)} 元`;
    case 'days':
      return `${fmtNum(p.days, 1)} 人日`;
  }
}

/** 拉桿的直線範圍內的位置（數字框填到拉桿範圍外時，拉桿停在端點） */
export function sliderValue(field: NumField, p: Params): number {
  const spec = FIELDS[field];
  if (spec.steps) return nearestStep(spec.steps, p[field]);
  const s = spec.slider!;
  return Math.min(s.max, Math.max(s.min, p[field]));
}

export function sliderBounds(field: NumField): { min: number; max: number; step: number } {
  const spec = FIELDS[field];
  if (spec.steps) return { min: 0, max: spec.steps.length - 1, step: 1 };
  return spec.slider!;
}

/** 拉桿已填滿的比例（CSS 變數 --fill） */
export function sliderFill(field: NumField, p: Params): string {
  const { min, max } = sliderBounds(field);
  return `${(((sliderValue(field, p) - min) / (max - min)) * 100).toFixed(2)}%`;
}

function rateBand(rate: number): string {
  if (rate < 1000) return '低於原文的初階區間（1,000–3,000）';
  if (rate <= 3000) return '落在原文的初階區間（1,000–3,000）';
  if (rate <= 5000) return '落在原文的中階區間（3,000–5,000）';
  return '落在原文的高階區間（5,000 以上）';
}

/** 頁面上隨參數變動的文字；SSR 與前端都從這裡取，兩邊才不會說法不一 */
export function describe(p: Params, r: Result = calc(p)) {
  const m = modelById(p.model);
  const preset = matchPreset(p);
  const computePct = r.computeShare === null ? '—' : fmtPct(r.computeShare);
  const laborPct = r.computeShare === null ? '—' : fmtPct(1 - r.computeShare);
  const genDuration = r.genSec >= 60 ? `（約 ${fmtDuration(r.genSec)}）` : '';
  return {
    hintLen: p.eps > 1 ? `每集 ${fmtDuration(p.len)}` : fmtDuration(p.len),
    hintEps:
      r.finalSec >= 60
        ? `成片共 ${fmtDuration(r.finalSec)}（${fmtNum(r.finalSec)} 秒）`
        : `成片共 ${fmtNum(r.finalSec)} 秒`,
    hintAdopt: `成片每 1 秒要生成 ${fmtNum(100 / p.adopt, 2)} 秒`,
    hintRev: p.rev > 0 ? `生成量再乘 ${fmtMultiplier(p.rev)}` : '不加修改預備量',
    hintPrice: m ? `${m.name} ${m.res} 的試算單價` : '自訂單價：用付款帳號當天的點數消耗換算後填入',
    hintRate: rateBand(p.rate),
    hintDays: p.labor
      ? `人力費 ${fmtNum(p.rate)} × ${fmtNum(p.days, 1)}＝${fmtNum(r.labor)} 元`
      : '未計入人力費',
    compute: fmtNum(r.compute),
    total: fmtNum(r.total),
    genDesc:
      r.discardSec > 0
        ? `需生成 ${fmtSec(r.genSec)} 秒${genDuration}，是成片的 ${fmtNum(r.ratio, 2)} 倍；其中 ${fmtSec(r.discardSec)} 秒不會進成片。`
        : `需生成 ${fmtSec(r.genSec)} 秒${genDuration}，與成片等長，沒有淘汰素材。`,
    computeWan: fmtWan(r.compute) ?? '',
    totalWan: fmtWan(r.total) ?? '',
    totalNote: p.labor ? '算力＋人力' : '未計人力，等於算力費',
    /* 數字與「元」之間用不換行空格，窄欄只會在逗號處折行 */
    laborRow: p.labor ? `${fmtNum(r.labor)} 元` : '未計入',
    perMin: p.labor
      ? `算力 ${fmtNum(r.perMinCompute)} 元，總價 ${fmtNum(r.perMinTotal)} 元`
      : `算力 ${fmtNum(r.perMinCompute)} 元`,
    computePct,
    laborPct,
    shareWidth: r.computeShare === null ? '0%' : `${(r.computeShare * 100).toFixed(2)}%`,
    shareLabel: `算力占 ${computePct}，人力占 ${laborPct}`,
    presetId: preset?.id ?? '',
    presetStatus: preset ? `已套用情境 ${preset.key}：${preset.label}` : '已改成自訂參數，點情境卡可還原',
    formula: formulaLines(p, r).join('\n'),
    live: `算力費 ${fmtNum(r.compute)} 元，試算總價 ${fmtNum(r.total)} 元`,
  };
}

export type Texts = ReturnType<typeof describe>;

/* ── 網址參數：?p=<情境> 或逐項參數，讓試算結果可以分享 ───────────── */
export function toSearch(p: Params): string {
  const preset = matchPreset(p);
  if (preset) return `?p=${preset.id}`;
  const q = new URLSearchParams();
  q.set('len', String(p.len));
  q.set('eps', String(p.eps));
  q.set('adopt', String(p.adopt));
  q.set('rev', String(p.rev));
  q.set('model', p.model);
  if (p.model === CUSTOM_MODEL) q.set('price', String(p.price));
  q.set('labor', p.labor ? '1' : '0');
  if (p.labor) {
    q.set('rate', String(p.rate));
    q.set('days', String(p.days));
  }
  return `?${q.toString()}`;
}

/** 解析網址參數；沒有任何可用參數時回傳 null（維持預設情境） */
export function fromSearch(search: string): Params | null {
  const q = new URLSearchParams(search);
  const preset = q.get('p');
  if (preset && presetById(preset)) return { ...presetById(preset)!.params };

  const keys = ['len', 'eps', 'adopt', 'rev', 'model', 'price', 'labor', 'rate', 'days'];
  if (!keys.some((k) => q.has(k))) return null;

  const base = defaultParams();
  const num = (field: NumField) => normalize(field, q.get(field)) ?? base[field];
  const modelParam = q.get('model') ?? '';
  const model = modelById(modelParam);
  const isCustom = modelParam === CUSTOM_MODEL;
  return {
    len: num('len'),
    eps: num('eps'),
    adopt: num('adopt'),
    rev: num('rev'),
    model: model ? model.id : isCustom ? CUSTOM_MODEL : base.model,
    price: model ? model.price : isCustom ? num('price') : base.price,
    labor: q.has('labor') ? q.get('labor') !== '0' : base.labor,
    rate: num('rate'),
    days: num('days'),
  };
}
