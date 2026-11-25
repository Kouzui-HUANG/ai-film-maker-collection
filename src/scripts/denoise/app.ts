/**
 * app.ts — /resource/ai-image-denoise/ 的互動：放圖、診斷檢視、縮放、比較、降噪、儲存
 *
 * 隱私：圖片只在這個分頁裡。讀檔用 createImageBitmap，計算在 denoise.worker.js，儲存是 canvas.toBlob ＋
 * <a download> 的本機 blob 網址；整條路上沒有 fetch、XHR、sendBeacon，也不送任何工具操作給 GA。
 * worker 在頁面載入時就建立，放圖之前程式碼已經下載好，所以載完頁面後斷網也能用。
 *
 * DOM 契約見頁面上的 data-dn-* 屬性；根元素的 data-state 是 empty / loading / ready（還沒降噪）/ done。
 */

/** iPhone Safari 的 canvas 面積上限約 4096×4096；桌機也用同一個上限，記憶體才不會爆 */
export const MAX_PIXELS = 4096 * 4096;
export const DEFAULTS = { chroma: 5, skin: 40 } as const;

type View = 'photo' | 'chroma' | 'diff' | 'mask';
type Side = 'before' | 'after';
type Zoom = 'fit' | 1 | 2;
type Phase = 'empty' | 'loading' | 'ready' | 'done';
type Layer = 'chroma-before' | 'chroma-after' | 'diff' | 'mask';
type Reply = { id: number; ok: boolean; buffer?: ArrayBuffer; ms?: number; error?: string };
type Params = { chroma: number; skin: number };

const CAPTION: Record<View, string> = {
  photo:
    '一般檢視。點「原圖」「降噪後」切換，按住不放是暫時看那一邊；放大到 100% 以上比較容易看出差別。',
  chroma:
    '只看顏色：亮度一律拉平、顏色放大 4 倍。斑駁的色塊、彩色的小顆粒就是色雜訊；顏色本來就豐富的地方（霓虹、花草、彩繪）也會很花，不代表髒。',
  diff:
    '改變幅度：這次降噪讓每個像素變了多少（ΔE）。平坦的地方亮成一片細點，是被抹掉的色雜訊；顏色交界也會亮成線，那是色邊被修順，不是雜訊。',
  mask:
    '膚色範圍：開啟「人像」時，膚色均勻只作用在染成靛藍的地方。沙灘、木頭、夕陽也可能被算成膚色，這種圖請關掉人像。',
};

/* ── worker：整個分頁一個，載入頁面就建立 ─────────────────── */
class DenoiseWorker {
  private worker: Worker;
  private seq = 0;
  private waiting = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker = new Worker(new URL('./denoise.worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<Reply>) => {
      const job = this.waiting.get(e.data.id);
      if (!job) return;
      this.waiting.delete(e.data.id);
      if (e.data.ok) job.resolve(e.data);
      else job.reject(new Error(e.data.error || '計算失敗'));
    };
    this.worker.onerror = (e) => {
      e.preventDefault();
      const err = new Error('背景計算停掉了（多半是圖太大、記憶體不夠），請重新整理網頁再試');
      for (const job of this.waiting.values()) job.reject(err);
      this.waiting.clear();
    };
  }

  call(msg: Record<string, unknown>, transfer: Transferable[] = []): Promise<Reply> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.worker.postMessage({ ...msg, id }, transfer);
    });
  }
}

export function setupDenoise(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];

  const fileInput = $<HTMLInputElement>('[data-dn-file]');
  const scroll = $('[data-dn-scroll]');
  const wrap = $('[data-dn-wrap]');
  const canvases: Record<Side, HTMLCanvasElement> = {
    before: $<HTMLCanvasElement>('[data-dn-canvas="before"]'),
    after: $<HTMLCanvasElement>('[data-dn-canvas="after"]'),
  };
  const chromaRange = $<HTMLInputElement>('[data-dn-chroma]');
  const skinRange = $<HTMLInputElement>('[data-dn-skin]');
  const portrait = $<HTMLInputElement>('[data-dn-portrait]');
  const runBtn = $<HTMLButtonElement>('[data-dn-run]');
  const saveBtn = $<HTMLButtonElement>('[data-dn-save]');
  const copyBtn = $<HTMLButtonElement>('[data-dn-copy]');
  const resetBtn = $<HTMLButtonElement>('[data-dn-reset]');
  const status = $('[data-dn-status]');
  const errorBox = $('[data-dn-error]');
  const live = $('[data-dn-live]');

  let worker: DenoiseWorker;
  try {
    worker = new DenoiseWorker();
  } catch {
    root.dataset.state = 'unsupported';
    return;
  }

  const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
  copyBtn.hidden = !canCopy;

  const st = {
    phase: 'empty' as Phase,
    gen: 0,            // 換一張就 +1，舊圖的結果回來時直接丟掉
    version: 0,        // 每次降噪 +1，舊設定的檢視回來時直接丟掉
    w: 0,
    h: 0,
    name: '',
    outType: 'image/png',
    orig: null as ImageData | null,
    out: null as ImageData | null,
    layers: new Map<Layer, ImageData>(),
    view: 'chroma' as View,
    side: 'before' as Side,
    zoom: 'fit' as Zoom,
    fitScale: 1,
    running: false,
    pending: false,
    applied: null as Params | null,
    drawn: { before: '', after: '' } as Record<Side, string>,
  };

  /* ── 小工具 ─────────────────────────────────────────── */
  const params = (): Params => ({
    chroma: Number(chromaRange.value),
    skin: portrait.checked ? Number(skinRange.value) : 0,
  });
  const sameParams = (a: Params | null, b: Params) => !!a && a.chroma === b.chroma && a.skin === b.skin;
  const fmtSec = (ms: number) => (ms < 1000 ? `${(ms / 1000).toFixed(2)}` : `${(ms / 1000).toFixed(1)}`);
  const fmtNum = (n: number) => n.toLocaleString('zh-TW');

  function say(text: string) {
    status.textContent = text;
    live.textContent = text;
  }
  function showError(text: string) {
    errorBox.textContent = text;
    errorBox.hidden = !text;
  }
  function setPhase(p: Phase) {
    st.phase = p;
    root.dataset.state = p;
    root.toggleAttribute('data-has-image', !!st.orig);
    syncControls();
  }

  /* ── 滑桿的數字、填滿段、說明 ─────────────────────────── */
  function syncSliders() {
    const c = Number(chromaRange.value), s = Number(skinRange.value);
    $('[data-dn-chroma-out]').textContent = String(c);
    $('[data-dn-skin-out]').textContent = `${s}%`;
    $('[data-dn-chroma-hint]').textContent = c === 0 ? '不做色彩降噪' : `照亮度的邊緣，把 ${c} 像素範圍內的顏色抹平`;
    chromaRange.style.setProperty('--fill', `${(c / Number(chromaRange.max)) * 100}%`);
    skinRange.style.setProperty('--fill', `${s}%`);
    chromaRange.setAttribute('aria-valuetext', c === 0 ? '0，不做' : `${c} 像素`);
    skinRange.setAttribute('aria-valuetext', `${s}%`);
    $('[data-dn-skin-field]').toggleAttribute('data-off', !portrait.checked);
    skinRange.disabled = !portrait.checked || st.phase === 'empty' || st.phase === 'loading';
  }

  /* ── 按鈕狀態 ───────────────────────────────────────── */
  function syncControls() {
    const has = st.phase === 'ready' || st.phase === 'done';
    const done = st.phase === 'done';
    const stale = st.running || st.pending || !sameParams(st.applied, params());
    chromaRange.disabled = !has;
    portrait.disabled = !has;
    resetBtn.disabled = !has;
    runBtn.disabled = !has || st.running;
    saveBtn.disabled = !done || stale;
    copyBtn.disabled = !done || stale;
    root.toggleAttribute('data-busy', st.running);

    for (const b of $$<HTMLButtonElement>('[data-dn-view]')) {
      const v = b.dataset.dnView as View;
      b.disabled = !has || ((v === 'diff' || v === 'mask') && !done);
      b.setAttribute('aria-pressed', String(v === st.view));
    }
    for (const b of $$<HTMLButtonElement>('[data-dn-zoom]')) {
      const z = b.dataset.dnZoom === 'fit' ? 'fit' : Number(b.dataset.dnZoom);
      b.disabled = !has;
      b.setAttribute('aria-pressed', String(z === st.zoom));
    }
    const comparable = st.view === 'photo' || st.view === 'chroma';
    $('[data-dn-compare-group]').toggleAttribute('data-inactive', !comparable);
    for (const b of $$<HTMLButtonElement>('[data-dn-compare]')) {
      const side = b.dataset.dnCompare as Side;
      b.disabled = !has || (side === 'after' && !done);
      b.setAttribute('aria-pressed', String(side === st.side));
    }
    $('[data-dn-caption]').textContent = CAPTION[st.view];
    $('[data-dn-legend="diff"]').hidden = st.view !== 'diff';
    $('[data-dn-legend="mask"]').hidden = st.view !== 'mask';
    syncSliders();
  }

  /* ── 縮放：符合畫面／100%／200%（100% 是一個圖片像素對一個 CSS 像素） ─── */
  function maxViewerHeight() {
    return Math.max(320, Math.min(window.innerHeight * 0.72, 960));
  }
  function applyZoom(anchor?: { x: number; y: number }) {
    if (!st.w) return;
    const box = scroll.parentElement!.clientWidth;
    st.fitScale = Math.min(1, box / st.w, maxViewerHeight() / st.h);
    const old = scroll.dataset.scale ? Number(scroll.dataset.scale) : st.fitScale;
    const scale = st.zoom === 'fit' ? st.fitScale : st.zoom;
    // 換倍率前記下畫面中心（或雙擊的點）在圖上的位置，換完捲回去
    const cx = anchor ? anchor.x : (scroll.scrollLeft + scroll.clientWidth / 2) / old;
    const cy = anchor ? anchor.y : (scroll.scrollTop + scroll.clientHeight / 2) / old;
    wrap.style.width = `${Math.round(st.w * scale)}px`;
    wrap.style.height = `${Math.round(st.h * scale)}px`;
    const zoomed = st.zoom !== 'fit';
    scroll.style.height = `${Math.round(zoomed ? Math.min(maxViewerHeight(), st.h * scale) : st.h * scale)}px`;
    scroll.toggleAttribute('data-zoomed', zoomed && (st.w * scale > box || st.h * scale > maxViewerHeight()));
    wrap.toggleAttribute('data-pixelated', scale >= 1);
    scroll.dataset.scale = String(scale);
    if (zoomed) {
      scroll.scrollLeft = cx * scale - scroll.clientWidth / 2;
      scroll.scrollTop = cy * scale - scroll.clientHeight / 2;
    } else {
      scroll.scrollLeft = 0;
      scroll.scrollTop = 0;
    }
    const pct = Math.round(scale * 100);
    $('[data-dn-zoom-now]').textContent = st.zoom === 'fit' ? `符合畫面（${pct}%）` : `${pct}%`;
  }
  function setZoom(z: Zoom, anchor?: { x: number; y: number }) {
    st.zoom = z;
    applyZoom(anchor);
    syncControls();
  }

  /* ── 畫面：兩張疊在一起的 canvas，比較時只切換顯示，不重畫 ── */
  function draw(side: Side, key: string, img: ImageData) {
    if (st.drawn[side] === key) return;
    const c = canvases[side];
    if (c.width !== img.width || c.height !== img.height) {
      c.width = img.width;
      c.height = img.height;
    }
    c.getContext('2d')!.putImageData(img, 0, 0);
    st.drawn[side] = key;
  }

  async function layer(name: Layer): Promise<ImageData | null> {
    const hit = st.layers.get(name);
    if (hit) return hit;
    const gen = st.gen, version = st.version;
    const res = await worker.call({ type: 'layer', name });
    if (gen !== st.gen || version !== st.version || !res.buffer) return null;  // 已經換圖或重算了
    const img = new ImageData(new Uint8ClampedArray(res.buffer), st.w, st.h);
    st.layers.set(name, img);
    return img;
  }

  // 只留目前檢視用得到的診斷圖，其他的放掉（大圖一張就是幾十 MB）
  function keepLayers(needed: Layer[]) {
    for (const k of [...st.layers.keys()]) if (!needed.includes(k)) st.layers.delete(k);
  }

  async function render() {
    if (!st.orig) return;
    const view = st.view, gen = st.gen, v = st.version;
    const needed: Layer[] =
      view === 'chroma' ? ['chroma-before', 'chroma-after'] : view === 'diff' ? ['diff'] : view === 'mask' ? ['mask'] : [];
    keepLayers(needed);
    try {
      if (view === 'photo') {
        draw('before', `photo:${gen}`, st.orig);
        if (st.out) draw('after', `photo:${gen}:${v}`, st.out);
      } else if (view === 'chroma') {
        const b = await layer('chroma-before');
        if (b && st.view === view) draw('before', `chroma:${gen}`, b);
        if (st.out) {
          const a = await layer('chroma-after');
          if (a && st.view === view) draw('after', `chroma:${gen}:${v}`, a);
        }
      } else {
        const img = await layer(view);
        if (img && st.view === view) draw('after', `${view}:${gen}:${v}`, img);
      }
    } catch (e) {
      showError(`檢視失敗：${(e as Error).message}`);
    }
    showSide();
  }

  function showSide() {
    const comparable = st.view === 'photo' || st.view === 'chroma';
    const side: Side = comparable ? (st.out ? st.side : 'before') : 'after';
    canvases.before.hidden = side !== 'before';
    canvases.after.hidden = side !== 'after';
  }

  function setView(v: View) {
    st.view = v;
    syncControls();
    render();
  }
  function setSide(s: Side) {
    st.side = s;
    syncControls();
    showSide();
  }

  /* ── 讀圖 ───────────────────────────────────────────── */
  const OUT_TYPES: Record<string, [string, string]> = {
    'image/png': ['image/png', 'png'],
    'image/jpeg': ['image/jpeg', 'jpg'],
    'image/webp': ['image/webp', 'webp'],
  };
  const FORMAT_LABEL: Record<string, string> = {
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/webp': 'WebP',
    'image/avif': 'AVIF',
    'image/gif': 'GIF',
    'image/bmp': 'BMP',
    'image/heic': 'HEIC',
    'image/heif': 'HEIF',
  };

  async function load(file: File, pasted = false) {
    showError('');
    if (st.phase === 'loading') return;
    if (st.running) {
      showError('還在計算，等它算完再換一張');
      return;
    }
    if (file.type && !file.type.startsWith('image/')) {
      showError('這不是圖片檔。請放 PNG、JPEG 或 WebP。');
      return;
    }
    const prevPhase = st.phase;
    setPhase('loading');
    say('讀取圖片中…');
    let bmp: ImageBitmap;
    try {
      bmp = await createImageBitmap(file);
    } catch {
      setPhase(prevPhase);
      say('');
      showError('瀏覽器解不開這個檔案。請先轉成 PNG、JPEG 或 WebP 再試。');
      return;
    }
    const w = bmp.width, h = bmp.height;
    if (w * h > MAX_PIXELS) {
      bmp.close();
      setPhase(prevPhase);
      say('');
      showError(
        `這張圖是 ${fmtNum(w)} × ${fmtNum(h)}，約 ${fmtNum(Math.round((w * h) / 1e4))} 萬像素，` +
          `超過上限 ${fmtNum(Math.round(MAX_PIXELS / 1e4))} 萬像素（4096 × 4096）。請先縮小再放進來。`,
      );
      return;
    }

    let orig: ImageData;
    try {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0);
      orig = ctx.getImageData(0, 0, w, h);
      c.width = c.height = 0;
    } catch {
      setPhase(prevPhase);
      say('');
      showError('圖太大，瀏覽器的記憶體不夠。請先縮小再試。');
      return;
    } finally {
      bmp.close();
    }

    st.gen++;
    st.version = 0;
    st.w = w;
    st.h = h;
    st.orig = orig;
    st.out = null;
    st.applied = null;
    st.layers.clear();
    st.drawn = { before: '', after: '' };
    st.side = 'before';
    st.view = 'chroma';
    st.zoom = 'fit';
    delete scroll.dataset.scale;

    const base = pasted ? '貼上的圖片' : file.name.replace(/\.[^./\\]+$/, '') || '圖片';
    const [outType, ext] = OUT_TYPES[file.type] ?? OUT_TYPES['image/png'];
    st.name = `${base}_降噪.${ext}`;
    st.outType = outType;
    const fmt = FORMAT_LABEL[file.type] ?? (file.type.replace('image/', '').toUpperCase() || '圖片');
    $('[data-dn-info-name]').textContent = pasted ? '貼上的圖片' : file.name;
    $('[data-dn-info-meta]').textContent = `${fmtNum(w)} × ${fmtNum(h)}　${fmt}`;
    $('[data-dn-save-name]').textContent = st.name;
    $('[data-dn-save-format]').textContent =
      outType === 'image/png' ? 'PNG 不失真' : `${ext === 'jpg' ? 'JPEG' : 'WebP'} 以 95% 品質重新壓縮`;

    try {
      const copy = new Uint8ClampedArray(orig.data);
      await worker.call({ type: 'load', width: w, height: h, buffer: copy.buffer }, [copy.buffer]);
    } catch (e) {
      st.orig = null;
      setPhase('empty');
      say('');
      showError(`讀取失敗：${(e as Error).message}`);
      return;
    }

    setPhase('ready');
    applyZoom();
    await render();
    say(`圖已載入：${fmtNum(w)} × ${fmtNum(h)}。先看診斷，再按「一鍵降噪」。`);
  }

  /* ── 降噪：拉滑桿就重算；算的時候又拉了，算完用最新的值再算一次 ── */
  async function run() {
    if (!st.orig || st.phase === 'loading') return;
    if (st.running) {
      st.pending = true;
      syncControls();
      return;
    }
    const p = params(), gen = st.gen;
    st.running = true;
    st.pending = false;
    showError('');
    say('計算中…');
    syncControls();
    try {
      const res = await worker.call({ type: 'run', radius: p.chroma, blotch: p.skin / 100 });
      if (gen !== st.gen || !res.buffer) return;
      st.out = new ImageData(new Uint8ClampedArray(res.buffer), st.w, st.h);
      st.version++;
      st.applied = p;
      st.layers.delete('chroma-after');
      st.layers.delete('diff');
      st.layers.delete('mask');
      if (st.phase !== 'done') {
        st.side = 'after';
        setPhase('done');
      }
      await render();
      say(
        `已套用：色雜訊 ${p.chroma}、膚色均勻 ${p.skin}%（計算 ${fmtSec(res.ms ?? 0)} 秒）。` +
          '按住「原圖」可以比較。',
      );
    } catch (e) {
      say('');
      showError(`降噪失敗：${(e as Error).message}`);
    } finally {
      st.running = false;
      if (st.pending && gen === st.gen) {
        st.pending = false;
        if (!sameParams(st.applied, params())) run();
      }
      syncControls();
    }
  }

  function onParamInput() {
    syncSliders();
    if (st.phase === 'done' || st.running) run();
    else syncControls();
  }

  /* ── 儲存與複製：在這台電腦上產生檔案，不經過網路 ─────────── */
  function encode(type: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!st.out) return reject(new Error('還沒有降噪的結果'));
      const c = document.createElement('canvas');
      c.width = st.w;
      c.height = st.h;
      c.getContext('2d')!.putImageData(st.out, 0, 0);
      c.toBlob(
        (blob) => {
          c.width = c.height = 0;
          blob ? resolve(blob) : reject(new Error('瀏覽器沒辦法產生這種格式的檔案'));
        },
        type,
        type === 'image/png' ? undefined : 0.95,
      );
    });
  }

  async function save() {
    showError('');
    try {
      const blob = await encode(st.outType);
      // 有些瀏覽器不支援輸出 WebP，會默默改成 PNG：副檔名跟著改
      const name = blob.type === st.outType ? st.name : st.name.replace(/\.[^.]+$/, '.png');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      say(`已存成「${name}」。`);
    } catch (e) {
      showError(`儲存失敗：${(e as Error).message}`);
    }
  }

  async function copy() {
    showError('');
    try {
      // Safari 要在使用者點擊的當下建立 ClipboardItem，內容用 Promise 給
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': encode('image/png') })]);
      say('已複製到剪貼簿（PNG），可以直接貼到其他軟體。');
    } catch (e) {
      showError(`複製失敗：${(e as Error).message}`);
    }
  }

  function reset() {
    chromaRange.value = String(DEFAULTS.chroma);
    skinRange.value = String(DEFAULTS.skin);
    portrait.checked = false;
    onParamInput();
  }

  /* ── 事件 ───────────────────────────────────────────── */
  for (const b of $$('[data-dn-pick]')) b.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) load(f);
    fileInput.value = '';
  });

  // 拖曳：整個工具區都接得住
  let dragDepth = 0;
  root.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    dragDepth++;
    root.setAttribute('data-drag', '');
  });
  root.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  root.addEventListener('dragleave', () => {
    if (--dragDepth <= 0) {
      dragDepth = 0;
      root.removeAttribute('data-drag');
    }
  });
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    root.removeAttribute('data-drag');
    const f = [...(e.dataTransfer?.files ?? [])].find((x) => !x.type || x.type.startsWith('image/'));
    if (f) load(f);
    else showError('沒有收到圖片檔。');
  });

  // ⌘V／Ctrl+V 貼上：只收圖片，貼到文字框的不攔
  document.addEventListener('paste', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || (t instanceof HTMLInputElement && t.type === 'text') || t instanceof HTMLTextAreaElement)) return;
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    const f = item?.getAsFile();
    if (!f) return;
    e.preventDefault();
    load(f, true);
  });

  for (const b of $$<HTMLButtonElement>('[data-dn-view]')) b.addEventListener('click', () => setView(b.dataset.dnView as View));
  for (const b of $$<HTMLButtonElement>('[data-dn-zoom]'))
    b.addEventListener('click', () => setZoom(b.dataset.dnZoom === 'fit' ? 'fit' : (Number(b.dataset.dnZoom) as Zoom)));

  // 原圖｜降噪後：點一下切換；按住不放是暫時看那一邊，放開就回來
  for (const b of $$<HTMLButtonElement>('[data-dn-compare]')) {
    const side = b.dataset.dnCompare as Side;
    let held: { prev: Side; t: number } | null = null;
    const release = () => {
      if (held && performance.now() - held.t > 300) setSide(held.prev);
      held = null;
    };
    b.addEventListener('pointerdown', (e) => {
      if (b.disabled || e.button !== 0) return;
      held = { prev: st.side, t: performance.now() };
      setSide(side);
    });
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('pointerleave', release);
    b.addEventListener('click', (e) => {
      if (e.detail === 0) setSide(side);  // 鍵盤
    });
  }

  // 放大時用滑鼠拖曳平移（觸控用原生的捲動）；雙擊在「符合畫面」和 100% 之間切換
  let pan: { x: number; y: number; left: number; top: number } | null = null;
  scroll.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !scroll.hasAttribute('data-zoomed')) return;
    pan = { x: e.clientX, y: e.clientY, left: scroll.scrollLeft, top: scroll.scrollTop };
    scroll.setPointerCapture(e.pointerId);
    scroll.setAttribute('data-panning', '');
  });
  scroll.addEventListener('pointermove', (e) => {
    if (!pan) return;
    scroll.scrollLeft = pan.left - (e.clientX - pan.x);
    scroll.scrollTop = pan.top - (e.clientY - pan.y);
  });
  const endPan = () => {
    pan = null;
    scroll.removeAttribute('data-panning');
  };
  scroll.addEventListener('pointerup', endPan);
  scroll.addEventListener('pointercancel', endPan);
  scroll.addEventListener('dblclick', (e) => {
    if (!st.orig) return;
    if (st.zoom === 'fit') {
      const r = wrap.getBoundingClientRect(), s = st.fitScale;
      setZoom(1, { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s });
    } else setZoom('fit');
  });

  chromaRange.addEventListener('input', onParamInput);
  skinRange.addEventListener('input', onParamInput);
  portrait.addEventListener('change', onParamInput);
  runBtn.addEventListener('click', run);
  saveBtn.addEventListener('click', save);
  copyBtn.addEventListener('click', copy);
  resetBtn.addEventListener('click', reset);

  // 視窗大小變了：重算「符合畫面」的倍率，畫面中心不動
  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (st.orig) applyZoom();
    });
  });

  // 防止把圖拖到工具區外面時，瀏覽器直接開啟那張圖（離開本頁）
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  setPhase('empty');
}
