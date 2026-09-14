#!/usr/bin/env node
/**
 * scripts/new-work.mjs — 從 YouTube / Vimeo 網址一鍵產出作品骨架（設計文件 §7-1）
 *
 *   node scripts/new-work.mjs <youtube-or-vimeo-url> --creator <slug> [--creator <slug2>] --genre <slug>
 *                             [--year 2026] [--released YYYY-MM-DD] [--slug <slug>] [--dry-run]
 *
 * 做的事：
 *   1. 呼叫免 key 的 oEmbed（YouTube / Vimeo）拿 title / author_name / thumbnail_url，逾時 15 秒
 *   2. 下載縮圖到 src/content/works/thumbs/<slug>.jpg
 *      YouTube 先試 maxresdefault.jpg（1280×720），404 退 hqdefault.jpg；
 *      拿到的不是 JPEG（Vimeo 常回 webp / png）就用 sharp 轉成 jpg
 *   3. 寫出 src/content/works/<slug>.md 骨架：frontmatter 全欄位、日期加引號、
 *      synopsis 留 TODO、tools 留空、videoUrl 正規化成 watch URL
 *
 * slug 規則：<主創作者 slug>-<title 的 ASCII 字母數字 kebab>（最長約 48 字元）；
 *            title 沒有任何 ASCII 字母數字（例如全中文）時退成 <creator>-<videoId>，或用 --slug 指定；
 *            撞名自動加 -2、-3。
 *
 * 純 Node ≥ 22（全域 fetch / AbortSignal.timeout），只用內建模組 + 專案已有的 sharp。
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKS_DIR = join(ROOT, 'src', 'content', 'works');
const THUMBS_DIR = join(WORKS_DIR, 'thumbs');
const CREATORS_DIR = join(ROOT, 'src', 'content', 'creators');
const GENRES_TS = join(ROOT, 'src', 'data', 'genres.ts');

const FETCH_TIMEOUT_MS = 15_000;
const SLUG_MAX = 48;
const UA = 'ai-film-maker-collection/new-work (Node; +https://github.com/)';

/* ── 輸出小工具 ─────────────────────────────────────────────── */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = paint(31);
const green = paint(32);
const yellow = paint(33);
const cyan = paint(36);
const dim = paint(2);
const bold = paint(1);

const USAGE = `${bold('new-work.mjs')} — 從 YouTube / Vimeo 網址產出作品骨架

用法
  node scripts/new-work.mjs <url> --creator <slug> [--creator <slug2>] --genre <slug>
                            [--year 2026] [--released YYYY-MM-DD] [--slug <slug>] [--dry-run]
  npm run new-work -- <url> --creator <slug> --genre <slug>

參數
  <url>                 YouTube（watch / youtu.be / shorts / embed）或 Vimeo 網址
  --creator <slug>      創作者資料夾名（src/content/creators/<slug>/），可重複；第一位為主創作者
  --genre <slug>        作品類型，須在 src/data/genres.ts 的 GENRES 內
  --year <yyyy>         年份；預設取 --released 的年份，否則取今年（台北）
  --released <date>     發表日 "YYYY-MM-DD"（Vimeo 會自動帶入 oEmbed 的上傳日）
  --slug <slug>         指定 slug（全小寫 kebab-case）；不給則自動由 title 產生
  --dry-run, -n         只印出會做的事，不寫檔、不下載
  --help, -h            本說明

產出
  src/content/works/<slug>.md          frontmatter 骨架（synopsis / tools / thumbAlt 留 TODO）
  src/content/works/thumbs/<slug>.jpg  縮圖（YouTube maxres → hq；非 JPEG 以 sharp 轉檔）

範例
  node scripts/new-work.mjs https://www.youtube.com/watch?v=aqz-KE-bpKQ --creator lin-yu-chen --genre short-film
  node scripts/new-work.mjs https://vimeo.com/1084537 --creator studio-nightshift --creator huang-chih-hao --genre commercial --dry-run
`;

function fail(msg, hint) {
  console.error(`${red('✗')} ${msg}`);
  if (hint) console.error(dim(`  ${hint}`));
  process.exit(1);
}

/* ── 參數解析 ───────────────────────────────────────────────── */
function parseArgs(argv) {
  const o = { url: null, creators: [], genre: null, year: null, released: null, slug: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    let inline = null;
    if (a.startsWith('--') && a.includes('=')) {
      const at = a.indexOf('=');
      inline = a.slice(at + 1);
      a = a.slice(0, at);
    }
    const value = () => {
      if (inline !== null) return inline;
      const v = argv[++i];
      if (v === undefined || v.startsWith('-')) fail(`${a} 後面要接值`);
      return v;
    };
    switch (a) {
      case '--help':
      case '-h':
        o.help = true;
        break;
      case '--dry-run':
      case '-n':
        o.dryRun = true;
        break;
      case '--creator':
        o.creators.push(value());
        break;
      case '--genre':
        o.genre = value();
        break;
      case '--year':
        o.year = value();
        break;
      case '--released':
        o.released = value();
        break;
      case '--slug':
        o.slug = value();
        break;
      default:
        if (a.startsWith('-')) fail(`不認識的選項 ${a}`, '用 --help 看用法');
        if (o.url) fail('一次只能給一個網址');
        o.url = a;
    }
  }
  return o;
}

/* ── 影片網址解析（與 src/data/queries.ts 的 parseVideoUrl 同規則） ── */
function parseVideoUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, '');

  if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] || null;
    else if (u.pathname.startsWith('/watch')) id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/);
      if (m) id = m[1];
    }
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      const watchUrl = `https://www.youtube.com/watch?v=${id}`;
      return {
        provider: 'youtube',
        id,
        watchUrl,
        oembedUrl: `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      };
    }
    return null;
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/^\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/|showcase\/\d+\/video\/)?(\d+)(?:\/([0-9a-f]+))?\/?$/i);
    if (m) {
      const id = m[1];
      // 未列出（unlisted）影片的 hash（/<id>/<hash> 或 ?h=）要保留進 watchUrl，否則上線後嵌入會失敗
      const hash = m[2] ?? u.searchParams.get('h') ?? '';
      const watchUrl = `https://vimeo.com/${id}${hash ? `/${hash}` : ''}`;
      const src = host === 'player.vimeo.com' ? watchUrl : raw;
      return {
        provider: 'vimeo',
        id,
        watchUrl,
        oembedUrl: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(src)}&width=1280`,
      };
    }
    return null;
  }
  return null;
}

/* ── 網路 ───────────────────────────────────────────────────── */
async function request(url, init = {}) {
  try {
    return await fetch(url, {
      ...init,
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'user-agent': UA, ...(init.headers ?? {}) },
    });
  } catch (e) {
    const why =
      e?.name === 'TimeoutError' || e?.name === 'AbortError'
        ? `逾時（${FETCH_TIMEOUT_MS / 1000} 秒內沒有回應）`
        : e?.cause?.code ?? e?.cause?.message ?? e?.message ?? String(e);
    throw new Error(`連線失敗：${why}\n  ${url}`);
  }
}

const OEMBED_HINT = {
  youtube: {
    401: '影片可能是私人影片、或上傳者停用了嵌入（oEmbed 拒絕）；請確認影片為公開或不公開列出',
    403: '影片可能是私人影片、或上傳者停用了嵌入（oEmbed 拒絕）',
    404: '找不到這支影片；請確認網址與影片 ID',
  },
  vimeo: {
    403: '影片的隱私設定不允許在第三方網站嵌入；請確認影片為公開或允許嵌入',
    404: '找不到這支影片；未列出（unlisted）影片請帶完整含 hash 的網址',
  },
};

async function fetchOEmbed(video) {
  const res = await request(video.oembedUrl, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const hint = OEMBED_HINT[video.provider]?.[res.status] ?? '稍後再試，或改用別的網址型式';
    throw new Error(`${video.provider} oEmbed 回應 HTTP ${res.status}\n  ${hint}\n  ${video.oembedUrl}`);
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`${video.provider} oEmbed 回傳的不是 JSON：${video.oembedUrl}`);
  }
  if (!data || typeof data.title !== 'string' || !data.title.trim()) {
    throw new Error(`${video.provider} oEmbed 沒有回傳 title，無法產生骨架`);
  }
  return {
    title: data.title.trim(),
    author: typeof data.author_name === 'string' ? data.author_name.trim() : '',
    thumbnailUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null,
    durationSec: Number.isInteger(data.duration) && data.duration > 0 ? data.duration : null,
    uploadDate: typeof data.upload_date === 'string' ? data.upload_date.slice(0, 10) : null,
  };
}

/** 縮圖候選清單（依優先序） */
function thumbCandidates(video, oembed) {
  const list = [];
  if (video.provider === 'youtube') {
    list.push({ url: `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`, label: 'maxresdefault（1280×720）' });
    list.push({ url: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`, label: 'hqdefault（480×360，建議之後換成正式劇照）', lowRes: true });
  }
  if (oembed.thumbnailUrl) {
    // Vimeo CDN 的尺寸寫在網址尾巴（…-d_960 或 …-d_640x360），oEmbed 常忽略 width；先要 1280×720，拿不到再退原尺寸
    const hd = oembed.thumbnailUrl.replace(/-d_\d+(?:x\d+)?(?=$|[?#])/, '-d_1280x720');
    if (hd !== oembed.thumbnailUrl) list.push({ url: hd, label: 'oEmbed thumbnail_url（改要 1280×720）' });
    list.push({ url: oembed.thumbnailUrl, label: 'oEmbed thumbnail_url' });
  }
  return list;
}

/** 依序試候選；dry-run 用 HEAD，正式用 GET。回傳 { candidate, buf|null } */
async function resolveThumb(candidates, { head }) {
  const tried = [];
  for (const cand of candidates) {
    let res;
    try {
      res = await request(cand.url, { method: head ? 'HEAD' : 'GET' });
    } catch (e) {
      tried.push(`${cand.url} → ${e.message.split('\n')[0]}`);
      continue;
    }
    if (!res.ok) {
      tried.push(`${cand.url} → HTTP ${res.status}`);
      continue;
    }
    if (head) return { candidate: cand, buf: null, contentType: res.headers.get('content-type') ?? '' };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) {
      tried.push(`${cand.url} → 檔案過小（${buf.length} bytes），疑似佔位圖`);
      continue;
    }
    return { candidate: cand, buf, contentType: res.headers.get('content-type') ?? '' };
  }
  throw new Error(`所有縮圖來源都抓不到：\n  ${tried.join('\n  ')}`);
}

const isJpeg = (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

/* ── slug ───────────────────────────────────────────────────── */
const isKebab = (s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

/** title → ASCII 字母數字的 kebab（去重音、全形轉半形），以整個單字為單位截到 SLUG_MAX */
function kebabFromTitle(title) {
  const words =
    title
      .normalize('NFKD')
      .replace(/[^\x20-\x7e]/g, ' ')
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? [];
  const out = [];
  let len = 0;
  for (const w of words) {
    const add = out.length ? w.length + 1 : w.length;
    if (out.length && len + add > SLUG_MAX) break;
    out.push(w);
    len += add;
  }
  return out.join('-');
}

const kebabFromId = (id) =>
  id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function uniqueSlug(base) {
  let slug = base;
  let n = 2;
  while (existsSync(join(WORKS_DIR, `${slug}.md`)) || existsSync(join(THUMBS_DIR, `${slug}.jpg`))) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

/* ── 受控詞彙（正則從 .ts 抓，不 import TS） ─────────────────── */
function readGenreSlugs() {
  const src = readFileSync(GENRES_TS, 'utf-8');
  const block = src.match(/export const GENRES[^=]*=\s*\[([\s\S]*?)\n\];/);
  const slugs = [...(block ? block[1] : src).matchAll(/\{\s*slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]);
  if (!slugs.length) fail(`讀不到 GENRES：${GENRES_TS}`);
  return slugs;
}

/* ── 主流程 ─────────────────────────────────────────────────── */
const todayTaipei = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const q = (s) => JSON.stringify(String(s));

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || process.argv.length <= 2) {
    console.log(USAGE);
    process.exit(o.help ? 0 : 1);
  }

  /* 驗證參數 */
  if (!o.url) fail('缺少影片網址', '用法：node scripts/new-work.mjs <url> --creator <slug> --genre <slug>');
  const video = parseVideoUrl(o.url);
  if (!video) fail(`不是可辨識的 YouTube / Vimeo 網址：${o.url}`, '支援 youtube.com/watch?v=、youtu.be/、/shorts/、/embed/、vimeo.com/<id>');

  if (!o.creators.length) fail('缺少 --creator <slug>（至少一位）');
  for (const c of o.creators) {
    if (!isKebab(c)) fail(`--creator「${c}」須為全小寫 kebab-case（= 創作者資料夾名）`);
    if (!existsSync(join(CREATORS_DIR, c, 'index.md'))) {
      fail(`找不到創作者：src/content/creators/${c}/index.md`, '先建立創作者資料夾，或檢查 slug 拼字');
    }
  }
  if (new Set(o.creators).size !== o.creators.length) fail('--creator 重複');

  if (!o.genre) fail('缺少 --genre <slug>');
  const genres = readGenreSlugs();
  if (!genres.includes(o.genre)) fail(`--genre「${o.genre}」不在受控詞彙`, `可用：${genres.join(' / ')}`);

  if (o.released !== null && !/^\d{4}-\d{2}-\d{2}$/.test(o.released)) fail('--released 須為 YYYY-MM-DD');
  if (o.year !== null && !/^\d{4}$/.test(o.year)) fail('--year 須為四位數年份');
  if (o.slug !== null && !isKebab(o.slug)) fail('--slug 須為全小寫 kebab-case');

  /* oEmbed */
  console.log(`${cyan('→')} oEmbed ${dim(video.oembedUrl)}`);
  let meta;
  try {
    meta = await fetchOEmbed(video);
  } catch (e) {
    fail(e.message);
  }
  console.log(`  ${bold('title')}   ${meta.title}`);
  console.log(`  ${bold('channel')} ${meta.author || dim('（無）')}`);
  if (meta.durationSec) console.log(`  ${bold('length')}  ${meta.durationSec} 秒`);
  if (meta.uploadDate) console.log(`  ${bold('upload')}  ${meta.uploadDate}`);

  /* 日期 / 年份 */
  const released = o.released ?? (meta.uploadDate && /^\d{4}-\d{2}-\d{2}$/.test(meta.uploadDate) ? meta.uploadDate : null);
  const year = o.year ? Number(o.year) : released ? Number(released.slice(0, 4)) : Number(todayTaipei().slice(0, 4));

  /* slug */
  const primary = o.creators[0];
  let base;
  let slugNote = '';
  if (o.slug) {
    base = o.slug;
    slugNote = '（--slug 指定）';
  } else {
    const kebab = kebabFromTitle(meta.title);
    if (kebab) base = `${primary}-${kebab}`;
    else {
      base = `${primary}-${kebabFromId(video.id)}`;
      slugNote = '（title 沒有 ASCII 字母數字，退成影片 ID；可用 --slug 指定）';
    }
  }
  const slug = uniqueSlug(base);
  if (slug !== base) slugNote += `（「${base}」已存在，改用 -${slug.slice(base.length + 1)}）`;

  const mdPath = join(WORKS_DIR, `${slug}.md`);
  const jpgPath = join(THUMBS_DIR, `${slug}.jpg`);

  /* 縮圖來源 */
  const candidates = thumbCandidates(video, meta);
  if (!candidates.length) fail('找不到任何縮圖來源（oEmbed 沒有 thumbnail_url）');
  let thumb;
  try {
    thumb = await resolveThumb(candidates, { head: o.dryRun });
  } catch (e) {
    fail(e.message);
  }

  /* frontmatter 骨架 */
  const md = [
    '---',
    `# 由 scripts/new-work.mjs 產生（${todayTaipei()}）· 來源：${meta.author || video.provider}`,
    `title: ${q(meta.title)}`,
    `slug: ${q(slug)}`,
    `creators: [${o.creators.map(q).join(', ')}]`,
    `year: ${year}`,
    released ? `releasedAt: ${q(released)}` : '# releasedAt: "YYYY-MM-DD"   # 發表日（選填，記得加引號）',
    `genre: ${q(o.genre)}`,
    'tools: []   # TODO：受控詞彙 slug（至少一個），見 src/data/tools.ts；每個工具須在 synopsis / note 提到',
    meta.durationSec ? `durationSec: ${meta.durationSec}` : '# durationSec: 180   # 片長秒數（選填，給 VideoObject.duration）',
    `videoUrl: ${q(video.watchUrl)}`,
    `thumb: ${q(`./thumbs/${slug}.jpg`)}`,
    'thumbAlt: "TODO"   # 描述縮圖畫面（無障礙與 SEO）',
    'synopsis: "TODO"   # 100–200 字作品簡介',
    'note: ""   # 製作手記／技術說明（選填）',
    'awards: []   # 得獎／入圍／官方入選（選填；結構與 status 見 src/content/works/README.md）',
    '---',
    '',
  ].join('\n');

  /* 摘要 */
  const rel = (p) => p.slice(ROOT.length + 1);
  console.log('');
  console.log(`${cyan('→')} slug     ${bold(slug)} ${dim(slugNote)}`);
  console.log(`  creators ${o.creators.join(', ')}    genre ${o.genre}    year ${year}${released ? `    released ${released}` : ''}`);
  console.log(`  video    ${video.watchUrl}`);
  console.log(`  thumb    ${thumb.candidate.url} ${dim(`← ${thumb.candidate.label}`)}`);

  if (o.dryRun) {
    console.log('');
    console.log(`${yellow('dry-run')} 不寫檔、不下載。實際執行會：`);
    console.log(`  1. 下載縮圖 → ${rel(jpgPath)}${/jpe?g/i.test(thumb.contentType) ? '' : `（content-type ${thumb.contentType || '未知'}，非 JPEG 會以 sharp 轉檔）`}`);
    console.log(`  2. 寫入 ${rel(mdPath)}：`);
    console.log(dim(md.replace(/^/gm, '     ')));
    return;
  }

  /* 寫檔 */
  mkdirSync(THUMBS_DIR, { recursive: true });
  let jpg = thumb.buf;
  if (!isJpeg(jpg)) {
    const { default: sharp } = await import('sharp');
    jpg = await sharp(jpg).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    console.log(`  ${dim(`縮圖非 JPEG（${thumb.contentType || '未知'}），已用 sharp 轉成 jpg`)}`);
  }
  writeFileSync(jpgPath, jpg);
  writeFileSync(mdPath, md, 'utf-8');

  console.log('');
  console.log(`${green('✓')} ${rel(jpgPath)} ${dim(`${(jpg.length / 1024).toFixed(0)} KB`)}`);
  console.log(`${green('✓')} ${rel(mdPath)}`);
  if (thumb.candidate.lowRes) console.log(`${yellow('⚠')} 這支影片沒有 maxresdefault，縮圖為 480×360；上線前建議換成正式劇照（16:9、1280×720 以上）`);

  console.log('');
  console.log(bold('下一步'));
  console.log(`  1. 打開 ${rel(mdPath)}，補 synopsis（100–200 字）、tools（受控詞彙，見 src/data/tools.ts）、thumbAlt`);
  console.log(`     ${dim('每個 tools 值都要在 synopsis / note 裡真的提到，npm run check 會查（防誤植）')}`);
  console.log(`  2. 視需要補 durationSec / releasedAt / awards，或把 ${rel(jpgPath)} 換成正式劇照（全彩、16:9）`);
  console.log('  3. npm run check   →   npm run build');
}

main().catch((e) => fail(e?.stack ?? String(e)));
