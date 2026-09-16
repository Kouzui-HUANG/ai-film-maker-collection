/**
 * AI 工具受控詞彙（工具棧索引軸的單一真相來源）。
 *
 * ⚠️ 工具標籤一律由編輯部人工填寫，不做自動推斷。
 *    上稿前跑 `npm run check`：每個 tools 值都必須存在於此清單，
 *    且該工具名稱在對應作品／創作者內文至少出現一次（防誤植）。
 *
 * slug＝英文 kebab-case（URL 用）；label＝顯示名稱；category＝在影視流程中的環節。
 */

export type ToolCategory = 'video' | 'image' | 'audio' | 'edit' | 'other';

export interface ToolDef {
  slug: string;
  label: string;
  category: ToolCategory;
  vendor?: string;
  /** 該工具在影視流程中的角色（工具索引頁的介紹文 + meta description） */
  note: string;
}

/** 建立 /tool/<slug>/ 頁的最低作品數門檻；低於此的工具僅存於 frontmatter（不建頁、chip 不可點） */
export const MIN_TOOL_WORKS = 2;

export const TOOL_CATEGORY_LABEL: Record<ToolCategory, string> = {
  video: '影片生成',
  image: '圖像生成',
  audio: '聲音・配樂',
  edit: '剪輯・後製',
  other: '其他',
};

export const TOOLS: ToolDef[] = [
  /* ── 影片生成 ─────────────────────────────────────────── */
  { slug: 'runway', label: 'Runway', category: 'video', vendor: 'Runway', note: 'Gen-3／Gen-4 系列影片生成模型，圖生影片與運鏡控制成熟，是台灣 AI 短片最常見的主力工具之一。' },
  { slug: 'kling', label: 'Kling', category: 'video', vendor: '快手', note: '可靈 AI 影片生成，長鏡頭與人物動作連貫性強，常用於敘事型短片與 MV。' },
  { slug: 'veo', label: 'Veo', category: 'video', vendor: 'Google', note: 'Google 的影片生成模型，原生支援聲音生成，適合對白與環境音同步的段落。' },
  { slug: 'sora', label: 'Sora', category: 'video', vendor: 'OpenAI', note: 'OpenAI 影片生成模型，擅長長段落一致性與複雜場景調度。' },
  { slug: 'luma', label: 'Luma Dream Machine', category: 'video', vendor: 'Luma AI', note: '快速迭代的影片生成工具，關鍵影格與循環鏡頭好用，常做動態分鏡草稿。' },
  { slug: 'hailuo', label: 'Hailuo', category: 'video', vendor: 'MiniMax', note: '海螺 AI 影片生成，人物表演與鏡頭語言表現穩定，價格友善。' },
  { slug: 'pika', label: 'Pika', category: 'video', vendor: 'Pika Labs', note: '以特效與風格化見長的影片生成工具，適合 MV 與廣告的視覺實驗。' },
  { slug: 'wan', label: 'Wan', category: 'video', vendor: '阿里巴巴', note: '開源影片生成模型，可本機部署與微調，控制力高，進階創作者常用。' },
  { slug: 'hunyuan-video', label: 'Hunyuan Video', category: 'video', vendor: '騰訊', note: '開源影片生成模型，與 ComfyUI 工作流搭配，適合需要客製控制的作品。' },
  { slug: 'seedance', label: 'Seedance', category: 'video', vendor: '字節跳動', note: '影片生成模型，支援多圖參考與 3D 動態參考輸入，角色一致性佳，連載型 AI 短劇常用。' },
  { slug: 'vidu', label: 'Vidu', category: 'video', vendor: '生數科技', note: '影片生成模型，參考圖轉影片的角色一致性強，二次元與動漫風格的 MV、OP 片頭常用。' },
  { slug: 'pixverse', label: 'PixVerse', category: 'video', vendor: 'PixVerse', note: '影片生成模型，對嘴（lip sync）可直接吃整段影片而非單張圖，在鏡頭運動中仍能對上口型，AI MV 的歌唱段落常用。' },
  { slug: 'topmediai', label: 'TopMediai', category: 'video', vendor: 'TopMediai', note: '整合 AI 音樂、圖像、影片與人聲處理的創作平台，適合從歌曲延伸角色、場景與音樂錄影帶的一站式工作流。' },
  { slug: 'jimeng', label: 'Jimeng（即夢 AI）', category: 'video', vendor: '字節跳動', note: '整合圖像、影片與音樂生成的創作平台；台灣創作者常以它補足多模型工作流中的動態、配樂與快速視覺迭代。' },
  { slug: 'ltx-studio', label: 'LTX Studio', category: 'video', vendor: 'Lightricks', note: '面向敘事影像的 AI 製作平台，涵蓋分鏡、鏡頭生成與首尾幀控制，適合以一致構圖串接長時間跨度的短片。' },

  /* ── 圖像生成 ─────────────────────────────────────────── */
  { slug: 'midjourney', label: 'Midjourney', category: 'image', vendor: 'Midjourney', note: '概念圖、角色設定與劇照級關鍵影格的主力工具，多數作品的視覺起點。' },
  { slug: 'stable-diffusion', label: 'Stable Diffusion', category: 'image', vendor: 'Stability AI', note: '開源圖像生成模型，搭配 LoRA 與 ControlNet 可做角色一致性與精準構圖。' },
  { slug: 'flux', label: 'FLUX', category: 'image', vendor: 'Black Forest Labs', note: '文字渲染與寫實度強的開源圖像模型，常做角色參考圖與場景關鍵影格。' },
  { slug: 'nano-banana', label: 'Nano Banana', category: 'image', vendor: 'Google', note: 'Gemini 影像編輯模型，角色一致性與局部修改快，適合多鏡頭參考圖批次產出。' },
  { slug: 'comfyui', label: 'ComfyUI', category: 'image', note: '節點式工作流介面，串接圖像與影片模型的自訂管線，進階創作者的控制中樞。' },
  { slug: 'gpt-image', label: 'GPT Image', category: 'image', vendor: 'OpenAI', note: 'ChatGPT 內建的影像生成與編輯模型，指令理解力強，適合角色設定、場景美術與封面設計的批次產出。' },
  { slug: 'seedream', label: 'Seedream', category: 'image', vendor: '字節跳動', note: '圖像生成模型，與同門的 Seedance 影片模型同一套素材語彙，常用於產角色卡、場景與道具的參考圖再送進影片生成。' },

  /* ── 聲音・配樂 ────────────────────────────────────────── */
  { slug: 'suno', label: 'Suno', category: 'audio', vendor: 'Suno', note: 'AI 音樂生成，MV 與短片配樂常用，可指定曲風與歌詞。' },
  { slug: 'udio', label: 'Udio', category: 'audio', vendor: 'Udio', note: 'AI 音樂生成，人聲與編曲品質高，適合完整歌曲的 MV 製作。' },
  { slug: 'elevenlabs', label: 'ElevenLabs', category: 'audio', vendor: 'ElevenLabs', note: 'AI 配音與語音克隆，旁白、角色對白與多語配音的主力工具。' },

  /* ── 剪輯・後製 ────────────────────────────────────────── */
  { slug: 'davinci-resolve', label: 'DaVinci Resolve', category: 'edit', vendor: 'Blackmagic Design', note: '剪輯與調色軟體，AI 生成素材的統一調色與最終成片多在此完成。' },
  { slug: 'premiere-pro', label: 'Premiere Pro', category: 'edit', vendor: 'Adobe', note: '剪輯軟體，與 After Effects 合成搭配，處理 AI 素材的節奏與轉場。' },
  { slug: 'final-cut-pro', label: 'Final Cut Pro', category: 'edit', vendor: 'Apple', note: '剪輯軟體，磁性時間軸對大量短鏡頭的排列與換位快，AI 生成素材逐鏡拼接的成片常在此收尾。' },
  { slug: 'after-effects', label: 'After Effects', category: 'edit', vendor: 'Adobe', note: '合成與動態設計，用於修補 AI 生成畫面的瑕疵、加字卡與特效層。' },
  { slug: 'photoshop', label: 'Photoshop', category: 'edit', vendor: 'Adobe', note: '影像編修軟體，用於修掉 AI 生成關鍵影格的手指、文字與穿幫細節，再送進影片模型。' },
  { slug: 'capcut', label: 'CapCut', category: 'edit', vendor: 'ByteDance', note: '輕量剪輯工具，短影音與社群版本的快速輸出常用。' },
  { slug: 'topaz-video', label: 'Topaz Video AI', category: 'edit', vendor: 'Topaz Labs', note: 'AI 放大與補幀，把生成影片拉到放映規格的常見最後一步。' },

  /* ── 其他 ─────────────────────────────────────────────── */
  { slug: 'blender', label: 'Blender', category: 'other', note: '開源 3D 軟體，用於建立場景參考、鏡頭預覽或與 AI 生成畫面合成。' },
  { slug: 'unreal-engine', label: 'Unreal Engine', category: 'other', vendor: 'Epic Games', note: '即時渲染引擎，虛擬製作與 AI 生成素材混用的場景控制工具。' },
  { slug: '3d-rendering', label: '3D 建模・渲染', category: 'other', note: '以三維模型鎖定建築、產品與攝影機位置，再把可控的結構和運鏡交給 AI 延伸人物、氣氛與特效。' },
  { slug: 'motion-capture', label: '動態捕捉', category: 'other', note: '把真人表演轉成虛擬角色的姿態與動作，常見於虛擬代言人、即時互動與數位主持系統。' },
  { slug: 'gaussian-splatting', label: 'Gaussian Splatting', category: 'other', note: '由實拍影像重建可自由取景的三維場景，能作為 AI 角色合成與虛擬製作的空間底稿。' },
];

export const TOOL_BY_SLUG: Record<string, ToolDef> = Object.fromEntries(TOOLS.map((t) => [t.slug, t]));

export function toolLabel(slug: string): string {
  return TOOL_BY_SLUG[slug]?.label ?? slug;
}

/**
 * 統計每個工具的作品數（用 works 而非 creators，因為門檻定義是「作品數」）。
 * 回傳 Map<slug, count>。
 */
export function getToolWorkCounts(works: { tools: string[] }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const w of works) {
    for (const s of new Set(w.tools)) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return counts;
}

/** 該工具是否達到建頁門檻（chip 是否可點） */
export function toolHasPage(counts: Map<string, number>, slug: string): boolean {
  return !!TOOL_BY_SLUG[slug] && (counts.get(slug) ?? 0) >= MIN_TOOL_WORKS;
}
