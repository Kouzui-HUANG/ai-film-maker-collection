/**
 * denoise.worker.js — 在 Web Worker 裡跑 denoise-core.js，算大圖時畫面不會卡住
 *
 * 頁面載入時就建立（離線也能用：worker 的程式碼在放圖之前就已經下載好），整個分頁只用這一個，不會 terminate。
 * 這個檔案和 denoise-core.js 都不碰網路：沒有 fetch、XHR、WebSocket，也不 importScripts 外部網址。
 *
 * 收：{ id, type: 'load', width, height, buffer }  換一張圖（buffer 是 RGBA 的 ArrayBuffer，會被留著當透明度來源）
 *     { id, type: 'run', radius, blotch }          降噪
 *     { id, type: 'layer', name }                  診斷檢視（照最近一次 run 的設定）
 *     { id, type: 'clear' }                        放掉整張圖的計算結果
 * 回：{ id, ok: true, buffer?, ms? } 或 { id, ok: false, error }
 */
import { createDenoiser } from './denoise-core.js';

let current = null;

self.onmessage = (e) => {
  const msg = e.data || {};
  const { id, type } = msg;
  try {
    if (type === 'clear') {
      current = null;
      self.postMessage({ id, ok: true });
      return;
    }
    if (type === 'load') {
      current = null;  // 先放掉上一張，記憶體才夠
      current = createDenoiser(new Uint8ClampedArray(msg.buffer), msg.width, msg.height);
      self.postMessage({ id, ok: true });
      return;
    }
    if (!current) throw new Error('還沒有收到圖片');
    const t0 = performance.now();
    let out;
    if (type === 'run') out = current.run(msg.radius, msg.blotch);
    else if (type === 'layer') out = current.layer(msg.name);
    else throw new Error('不認得的指令：' + type);
    self.postMessage({ id, ok: true, buffer: out.buffer, ms: Math.round(performance.now() - t0) }, [out.buffer]);
  } catch (err) {
    const text = (err && err.message) || String(err);
    self.postMessage({
      id,
      ok: false,
      error: err instanceof RangeError || /allocation|memory/i.test(text) ? '圖太大，瀏覽器的記憶體不夠' : text,
    });
  }
};
