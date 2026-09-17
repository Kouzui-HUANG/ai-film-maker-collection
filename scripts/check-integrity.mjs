#!/usr/bin/env node
/**
 * scripts/check-integrity.mjs — 上稿前的機械檢核（設計文件 §7-2）
 *
 * 掃 src/content/**，把「build 才會炸」與「build 不會炸但上線就出事」的問題提前抓出來：
 *
 *   錯誤（exit 1）
 *     creators  資料夾名 ≠ slug、編號重複或跳號（須 1..N 連續）、
 *               tools / genres / categories 不在受控詞彙、肖像檔不存在、listedAt / updatedAt 沒加引號、sameAs 不是 http(s)
 *     works     檔名 ≠ slug、creators reference 解析不到、genre / tools 不在受控詞彙、tools 為空、
 *               縮圖不存在、videoUrl 不是 YouTube / Vimeo、releasedAt 沒加引號、awards 格式或狀態不合法、
 *               press 格式不合法或 date 沒加引號、headline 超過一部
 *     posts     urlSlug 重複、type / level 不合法、creators reference 解析不到、封面不存在、
 *               date / updated 沒加引號、excerpt 超過 180 字、tools 不在受控詞彙
 *     events    檔名 ≠ slug、kind 不合法、startDate / endDate / deadline 沒加引號、封面不存在、officialUrl 不是 http(s)、
 *               country 不是 ISO 3166-1 兩碼、currency 不是 ISO 4217 三碼
 *
 *   警告（exit 0）
 *     工具標籤在該條目內文找不到（防誤植）、同一支影片收在多部作品、press 連結重複、headline 一部都沒有、
 *     posts 資料夾名 ≠ urlSlug、endDate < startDate、deadline > startDate、海外活動 fee 有金額卻沒填 currency、
 *     new-work.mjs 骨架的 TODO 還沒補…
 *
 * 用法
 *   npm run check                              # = node scripts/check-integrity.mjs
 *   node scripts/check-integrity.mjs --quiet   # 只印錯誤與摘要（不印警告）
 *   node scripts/check-integrity.mjs --help
 *
 * 受控詞彙用正則從 src/data/tools.ts / genres.ts 抓、enum 從 src/content.config.ts 抓（不 import TS）。
 * 純 Node ≥ 22，只用內建模組 + 專案已有的 js-yaml。
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'src', 'content');
const DIR = {
  creators: join(CONTENT, 'creators'),
  works: join(CONTENT, 'works'),
  posts: join(CONTENT, 'posts'),
  events: join(CONTENT, 'events'),
};
const TOOLS_TS = join(ROOT, 'src', 'data', 'tools.ts');
const GENRES_TS = join(ROOT, 'src', 'data', 'genres.ts');
const CREATOR_CATEGORIES_TS = join(ROOT, 'src', 'data', 'creator-categories.ts');
const CONFIG_TS = join(ROOT, 'src', 'content.config.ts');

const EXCERPT_MAX = 180;
const TAGLINE_MAX = 40;

/* ── CLI ────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`check-integrity.mjs — 上稿前的內容檢核

用法
  npm run check
  node scripts/check-integrity.mjs [--quiet]

  --quiet, -q   只印錯誤與摘要
  --help, -h    本說明

結束碼：有錯誤 → 1；只有警告或全部通過 → 0`);
  process.exit(0);
}
const QUIET = argv.includes('--quiet') || argv.includes('-q');

/* ── 輸出小工具 ─────────────────────────────────────────────── */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = paint(31);
const green = paint(32);
const yellow = paint(33);
const cyan = paint(36);
const dim = paint(2);
const bold = paint(1);

/** 問題收集：依收集順序印出，最後統計 */
const problems = [];
const err = (where, msg) => problems.push({ level: 'error', where, msg });
const warn = (where, msg) => problems.push({ level: 'warn', where, msg });

/* ── 受控詞彙與 enum（正則抓，不 import TS） ─────────────────── */
function readVocab(file, constName) {
  const src = readFileSync(file, 'utf-8');
  const block = src.match(new RegExp(`export const ${constName}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\];`));
  const map = new Map();
  for (const m of (block ? block[1] : src).matchAll(/\{\s*slug:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'/g)) map.set(m[1], m[2]);
  if (!map.size) {
    console.error(`${red('✗')} 讀不到 ${constName}：${file}`);
    process.exit(2);
  }
  return { map, src };
}
const { map: TOOLS, src: toolsSrc } = readVocab(TOOLS_TS, 'TOOLS');
const { map: GENRES } = readVocab(GENRES_TS, 'GENRES');
const { map: CREATOR_CATEGORIES } = readVocab(CREATOR_CATEGORIES_TS, 'CREATOR_CATEGORIES');
const MIN_TOOL_WORKS = Number(toolsSrc.match(/MIN_TOOL_WORKS\s*=\s*(\d+)/)?.[1] ?? 2);

const configSrc = existsSync(CONFIG_TS) ? readFileSync(CONFIG_TS, 'utf-8') : '';
function readEnum(field, fallback) {
  const m = configSrc.match(new RegExp(`\\b${field}:\\s*z\\.enum\\(\\[([^\\]]*)\\]`));
  const list = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
  return list.length ? list : fallback;
}
const EVENT_KINDS = readEnum('kind', ['competition', 'workshop', 'screening', 'talk', 'exhibition']);
const POST_TYPES = readEnum('type', ['interview', 'tutorial']);
const LEVELS = readEnum('level', ['beginner', 'intermediate', 'advanced']);
const WORK_AWARD_STATUSES = readEnum('status', ['winner', 'finalist', 'selection']);

/* ── 檔案讀取 ───────────────────────────────────────────────── */
const skipName = (n) => n.startsWith('.') || n.startsWith('_') || n === 'README.md';

function listDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => !skipName(n) && statSync(join(dir, n)).isDirectory())
    .sort();
}
function listMd(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.md') && !skipName(n) && statSync(join(dir, n)).isFile())
    .sort();
}

/** 讀 md → { data, raw, body } 或 { parseError } */
function readEntry(file) {
  const md = readFileSync(file, 'utf-8');
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!m) return { parseError: '沒有 frontmatter（檔案須以 --- 開頭）' };
  let data;
  try {
    data = yaml.load(m[1]) ?? {};
  } catch (e) {
    return { parseError: `YAML 解析失敗：${String(e.message ?? e).split('\n')[0]}` };
  }
  if (typeof data !== 'object' || Array.isArray(data)) return { parseError: 'frontmatter 不是物件' };
  return { data, raw: m[1], body: m[2] ?? '' };
}

/* ── 共用檢查 ───────────────────────────────────────────────── */
const isHttp = (u) => typeof u === 'string' && /^https?:\/\/\S+$/.test(u);
const isKebab = (s) => typeof s === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 日期欄位必須在原始 YAML 裡加引號："2026-09-12"
 * （未加引號會被 YAML 當成 Date 物件 → zod 的 z.string() 直接 build 失敗）
 */
function checkDateQuoted(where, raw, field, { required = false } = {}) {
  const line = raw.split(/\r?\n/).find((l) => new RegExp(`^${field}:`).test(l));
  if (!line) {
    if (required) err(where, `${field} 未填`);
    return;
  }
  if (!new RegExp(`^${field}:\\s*(["'])\\d{4}-\\d{2}-\\d{2}\\1\\s*(#.*)?$`).test(line)) {
    err(where, `${field} 須為加引號的 "YYYY-MM-DD"（目前：${line.trim()}）`);
  }
}

function checkImage(where, baseDir, field, value) {
  if (typeof value !== 'string' || !value.trim()) {
    err(where, `${field} 未填`);
    return;
  }
  if (!existsSync(join(baseDir, value))) err(where, `${field} 指到的圖檔不存在：${value}`);
}

/** 陣列值都要在受控詞彙裡；回傳合法的值 */
function checkVocab(where, field, values, vocab, vocabName, { required = false } = {}) {
  if (values === undefined || values === null) {
    if (required) err(where, `${field} 未填`);
    return [];
  }
  if (!Array.isArray(values)) {
    err(where, `${field} 須為陣列`);
    return [];
  }
  if (required && !values.length) err(where, `${field} 不可為空（至少一個受控詞彙）`);
  const ok = [];
  for (const v of values) {
    if (typeof v !== 'string') err(where, `${field} 含非字串值：${JSON.stringify(v)}`);
    else if (!vocab.has(v)) err(where, `${field}「${v}」不在受控詞彙（${vocabName}）`);
    else ok.push(v);
  }
  if (new Set(ok).size !== ok.length) warn(where, `${field} 有重複值`);
  return ok;
}

/** 工具標籤防誤植：label 或 slug 至少在內文出現一次（不分大小寫；ASCII 名稱以字元邊界比對） */
function mentions(text, tool) {
  const hay = text.toLowerCase();
  const needles = [TOOLS.get(tool), tool].filter(Boolean).map((s) => s.toLowerCase());
  return needles.some((n) =>
    /^[a-z0-9 .+-]+$/.test(n) ? new RegExp(`(?<![a-z0-9])${escapeRe(n)}(?![a-z0-9])`).test(hay) : hay.includes(n),
  );
}
function checkToolMentions(where, tools, text) {
  for (const t of tools) {
    if (!mentions(text, t)) warn(where, `tools「${t}」（${TOOLS.get(t)}）在內文找不到，請確認不是誤植`);
  }
}

/** 解析 creators reference 陣列；回傳解析得到的 id */
function checkCreatorRefs(where, refs, creators, { required, isDraft }) {
  if (refs === undefined || refs === null) {
    if (required) err(where, 'creators 未填');
    return [];
  }
  if (!Array.isArray(refs)) {
    err(where, 'creators 須為陣列');
    return [];
  }
  if (required && !refs.length) err(where, 'creators 不可為空');
  const ok = [];
  for (const r of refs) {
    if (typeof r !== 'string') {
      err(where, `creators 含非字串值：${JSON.stringify(r)}`);
      continue;
    }
    const c = creators.get(r);
    if (!c) err(where, `找不到創作者「${r}」（應為 src/content/creators/${r}/index.md）`);
    else if (c.draft && !isDraft) err(where, `創作者「${r}」是 draft，非 draft 條目參照它會讓 build 失敗`);
    else ok.push(r);
  }
  return ok;
}

/* ── 影片 URL（與 src/data/queries.ts 的 parseVideoUrl 同規則） ── */
function parseVideoUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  if (['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) {
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] || null;
    else if (u.pathname.startsWith('/watch')) id = u.searchParams.get('v');
    else id = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/)?.[1] ?? null;
    return id ? { provider: 'youtube', id } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // 與 src/data/queries.ts parseVideoUrl 同規則（依路徑結構，不把 /user123/ 當影片 id）
    const id = u.pathname.match(/^\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/|showcase\/\d+\/video\/)?(\d+)(?:\/[0-9a-f]+)?\/?$/i)?.[1];
    return id ? { provider: 'vimeo', id } : null;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   creators
   ═══════════════════════════════════════════════════════════════ */
const creators = new Map(); // id → { data, draft }

for (const name of readdirSync(DIR.creators).sort()) {
  if (skipName(name)) continue;
  const full = join(DIR.creators, name);
  if (!statSync(full).isDirectory()) {
    if (name.endsWith('.md')) err(`creators/${name}`, '創作者須放在 creators/<slug>/index.md，不可直接放單檔');
    continue;
  }
  const idx = join(full, 'index.md');
  if (!existsSync(idx)) {
    warn(`creators/${name}/`, '沒有 index.md，Astro 會略過這個資料夾');
    continue;
  }
  for (const extra of listMd(full)) {
    if (extra !== 'index.md') err(`creators/${name}/${extra}`, '資料夾內只能有 index.md（其他 .md 會被當成另一筆條目）');
  }

  const where = `creators/${name}/index.md`;
  const e = readEntry(idx);
  if (e.parseError) {
    err(where, e.parseError);
    continue;
  }
  const { data, raw, body } = e;
  const draft = data.draft === true;
  creators.set(name, { data, draft });

  if (data.slug !== name) err(where, `資料夾名「${name}」≠ slug「${data.slug ?? '（未填）'}」`);
  else if (!isKebab(name)) err(where, `slug「${name}」須為全小寫 kebab-case`);

  if (!Number.isInteger(data.no) || data.no < 1) err(where, `no 須為正整數（目前：${JSON.stringify(data.no)}）`);
  if (typeof data.name !== 'string' || !data.name.trim()) err(where, 'name 未填');
  if (typeof data.tagline !== 'string' || !data.tagline.trim()) err(where, 'tagline 未填');
  else if (data.tagline.length > TAGLINE_MAX) err(where, `tagline 超過 ${TAGLINE_MAX} 字（${data.tagline.length} 字）`);
  if (typeof data.bio !== 'string' || !data.bio.trim()) err(where, 'bio 未填');
  else if (data.bio.length < 80) warn(where, `bio 只有 ${data.bio.length} 字，建議 150–250 字`);
  if (typeof data.portraitAlt !== 'string' || !data.portraitAlt.trim()) err(where, 'portraitAlt 未填');

  const tools = checkVocab(where, 'tools', data.tools, TOOLS, 'src/data/tools.ts', { required: true });
  checkVocab(where, 'genres', data.genres, GENRES, 'src/data/genres.ts', { required: true });
  checkVocab(where, 'categories', data.categories, CREATOR_CATEGORIES, 'src/data/creator-categories.ts', { required: true });
  checkImage(where, full, 'portrait', data.portrait);

  checkDateQuoted(where, raw, 'listedAt', { required: true });
  checkDateQuoted(where, raw, 'updatedAt');
  if (isDateStr(data.listedAt) && isDateStr(data.updatedAt) && data.updatedAt < data.listedAt) {
    warn(where, `updatedAt（${data.updatedAt}）早於 listedAt（${data.listedAt}）`);
  }

  if (data.sameAs !== undefined) {
    if (typeof data.sameAs !== 'object' || data.sameAs === null || Array.isArray(data.sameAs)) err(where, 'sameAs 須為物件（youtube / instagram / x / threads / vimeo / website）');
    else for (const [k, v] of Object.entries(data.sameAs)) if (!isHttp(v)) err(where, `sameAs.${k} 不是 http(s) URL：${JSON.stringify(v)}`);
  }
  if (Array.isArray(data.awards)) {
    data.awards.forEach((a, i) => {
      if (!a || typeof a !== 'object' || !Number.isInteger(a.year) || typeof a.title !== 'string' || typeof a.result !== 'string') {
        err(where, `awards[${i}] 須為 { year: 數字, title, result }`);
      }
    });
  }

  checkToolMentions(where, tools, `${data.tagline ?? ''}\n${data.bio ?? ''}\n${body}`);
}

/* 編號：不可重複、不可跳號（含 draft，編號在收錄時就固定） */
{
  const byNo = new Map();
  for (const [id, c] of creators) {
    if (!Number.isInteger(c.data.no) || c.data.no < 1) continue;
    if (!byNo.has(c.data.no)) byNo.set(c.data.no, []);
    byNo.get(c.data.no).push(id);
  }
  for (const [no, ids] of [...byNo].sort((a, b) => a[0] - b[0])) {
    if (ids.length > 1) err('creators', `編號 No.${no} 重複：${ids.join('、')}`);
  }
  const max = Math.max(0, ...byNo.keys());
  const missing = [];
  for (let n = 1; n <= max; n++) if (!byNo.has(n)) missing.push(n);
  if (missing.length) err('creators', `編號跳號：缺 No.${missing.join('、No.')}（共 ${creators.size} 位，編號應為 1..${creators.size} 連續）`);
}

/* ═══════════════════════════════════════════════════════════════
   works
   ═══════════════════════════════════════════════════════════════ */
const works = [];
const videoSeen = new Map(); // provider:id → [work ids]

for (const file of listMd(DIR.works)) {
  const id = basename(file, '.md');
  const where = `works/${file}`;
  const e = readEntry(join(DIR.works, file));
  if (e.parseError) {
    err(where, e.parseError);
    continue;
  }
  const { data, raw, body } = e;
  const draft = data.draft === true;
  works.push({ id, data, draft });

  if (data.slug !== id) err(where, `檔名「${id}」≠ slug「${data.slug ?? '（未填）'}」`);
  else if (!isKebab(id)) err(where, `slug「${id}」須為全小寫 kebab-case`);
  if (typeof data.title !== 'string' || !data.title.trim()) err(where, 'title 未填');
  if (!Number.isInteger(data.year)) err(where, `year 須為整數（目前：${JSON.stringify(data.year)}）`);

  checkCreatorRefs(where, data.creators, creators, { required: true, isDraft: draft });

  if (typeof data.genre !== 'string') err(where, 'genre 未填（單一值）');
  else if (!GENRES.has(data.genre)) err(where, `genre「${data.genre}」不在受控詞彙（src/data/genres.ts）`);
  const tools = checkVocab(where, 'tools', data.tools, TOOLS, 'src/data/tools.ts', { required: true });

  checkImage(where, DIR.works, 'thumb', data.thumb);
  if (typeof data.thumbAlt !== 'string' || !data.thumbAlt.trim()) err(where, 'thumbAlt 未填');
  else if (/^TODO\b/i.test(data.thumbAlt.trim())) warn(where, 'thumbAlt 還是 TODO');

  if (typeof data.videoUrl !== 'string') err(where, 'videoUrl 未填');
  else {
    const v = parseVideoUrl(data.videoUrl);
    if (!v) err(where, `videoUrl 不是可辨識的 YouTube / Vimeo 網址：${data.videoUrl}`);
    else if (!draft) {
      const key = `${v.provider}:${v.id}`;
      if (!videoSeen.has(key)) videoSeen.set(key, []);
      videoSeen.get(key).push(id);
    }
  }

  checkDateQuoted(where, raw, 'releasedAt');
  if (isDateStr(data.releasedAt) && Number.isInteger(data.year) && Number(data.releasedAt.slice(0, 4)) !== data.year) {
    warn(where, `year（${data.year}）與 releasedAt（${data.releasedAt}）年份不一致`);
  }
  if (data.durationSec !== undefined && (!Number.isInteger(data.durationSec) || data.durationSec <= 0)) err(where, 'durationSec 須為正整數秒數');

  if (typeof data.synopsis !== 'string' || !data.synopsis.trim()) err(where, 'synopsis 未填');
  else if (/^TODO\b/i.test(data.synopsis.trim())) warn(where, 'synopsis 還是 TODO（new-work.mjs 骨架尚未補完）');
  else if (data.synopsis.length < 40) warn(where, `synopsis 只有 ${data.synopsis.length} 字，建議 100–200 字`);

  if (data.awards !== undefined && !Array.isArray(data.awards)) {
    err(where, 'awards 須為陣列');
  } else if (Array.isArray(data.awards)) {
    data.awards.forEach((award, i) => {
      if (!award || typeof award !== 'object' || Array.isArray(award)) {
        err(where, `awards[${i}] 須為 { year, title, result, status }`);
        return;
      }
      if (!Number.isInteger(award.year)) err(where, `awards[${i}].year 須為整數`);
      if (typeof award.title !== 'string' || !award.title.trim()) err(where, `awards[${i}].title 未填`);
      if (typeof award.result !== 'string' || !award.result.trim()) err(where, `awards[${i}].result 未填`);
      if (!WORK_AWARD_STATUSES.includes(award.status)) {
        err(where, `awards[${i}].status「${award.status ?? '（未填）'}」不合法（${WORK_AWARD_STATUSES.join(' / ')}）`);
      }
    });
  }

  if (data.press !== undefined && !Array.isArray(data.press)) {
    err(where, 'press 須為陣列');
  } else if (Array.isArray(data.press)) {
    const pressUrls = new Set();
    data.press.forEach((item, i) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        err(where, `press[${i}] 須為 { outlet, title, url, date? }`);
        return;
      }
      if (typeof item.outlet !== 'string' || !item.outlet.trim()) err(where, `press[${i}].outlet 未填`);
      if (typeof item.title !== 'string' || !item.title.trim()) err(where, `press[${i}].title 未填`);
      if (!isHttp(item.url)) err(where, `press[${i}].url 不是 http(s) URL：${JSON.stringify(item.url)}`);
      else if (pressUrls.has(item.url)) warn(where, `press 有重複的連結：${item.url}`);
      else pressUrls.add(item.url);
      /* 沒加引號的日期會被 YAML 轉成 Date 物件，zod 的 z.string() 會在 build 時炸 */
      if (item.date !== undefined && !isDateStr(item.date)) {
        err(where, `press[${i}].date 須為加引號的 "YYYY-MM-DD"（目前：${JSON.stringify(item.date)}）`);
      }
    });
  }

  checkToolMentions(where, tools, `${data.title ?? ''}\n${data.synopsis ?? ''}\n${data.note ?? ''}\n${body}`);
}

for (const [key, ids] of videoSeen) {
  if (ids.length > 1) warn('works', `同一支影片（${key}）出現在多部作品：${ids.join('、')}`);
}

/* headline：非 draft 恰好一部 */
{
  const headlines = works.filter((w) => !w.draft && w.data.headline === true).map((w) => w.id);
  if (headlines.length > 1) err('works', `headline: true 有 ${headlines.length} 部（${headlines.join('、')}），全站只能一部`);
  else if (headlines.length === 0 && works.length) warn('works', 'headline: true 一部都沒有，首頁頭條會退回最新作品');
}

/* 創作者標了某個類型、但站上該類型 0 部作品 → /genre/<slug>/ 不會建頁
   （創作者頁的該 chip 會退成不可點；這裡提醒編輯補作品或拿掉標記） */
{
  const genreWorkCount = new Map();
  for (const w of works.filter((x) => !x.draft)) {
    const g = w.data.genre;
    if (g) genreWorkCount.set(g, (genreWorkCount.get(g) ?? 0) + 1);
  }
  for (const [id, c] of creators) {
    if (c.draft) continue;
    for (const g of Array.isArray(c.data.genres) ? c.data.genres : []) {
      if (GENRES.has(g) && (genreWorkCount.get(g) ?? 0) === 0) {
        warn(`creators/${id}/index.md`, `標了類型「${g}」但站上該類型 0 部作品，/genre/${g}/ 不會建頁`);
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   posts
   ═══════════════════════════════════════════════════════════════ */
const posts = [];
const urlSlugSeen = new Map();

for (const folder of listDirs(DIR.posts)) {
  const full = join(DIR.posts, folder);
  const idx = join(full, 'index.md');
  if (!existsSync(idx)) {
    warn(`posts/${folder}/`, '沒有 index.md，Astro 會略過這個資料夾');
    continue;
  }
  for (const extra of listMd(full)) {
    if (extra !== 'index.md') err(`posts/${folder}/${extra}`, '資料夾內只能有 index.md（其他 .md 會被當成另一篇）');
  }
  const where = `posts/${folder}/index.md`;
  const e = readEntry(idx);
  if (e.parseError) {
    err(where, e.parseError);
    continue;
  }
  const { data, raw, body } = e;
  const draft = data.draft === true;
  posts.push({ id: folder, data, draft });
  // FAQ 版式：`**答：**答覆` 的結尾 ** 緊接中文不算 right-flanking，Markdown 會以字面星號渲染
  if (/\*\*(?:答|作者|編輯部|圖鑑編輯部|A\d*)[：:]\*\*(?!\s)/.test(body)) {
    err(where, 'FAQ 答覆請寫成 `**答**：答覆`（冒號放在粗體外），`**答：**答覆` 不會渲染成粗體');
  }

  if (typeof data.urlSlug !== 'string' || !isKebab(data.urlSlug)) err(where, `urlSlug 須為全小寫 kebab-case（目前：${JSON.stringify(data.urlSlug)}）`);
  else {
    if (data.urlSlug !== folder) warn(where, `資料夾名「${folder}」≠ urlSlug「${data.urlSlug}」，建議一致`);
    if (!urlSlugSeen.has(data.urlSlug)) urlSlugSeen.set(data.urlSlug, []);
    urlSlugSeen.get(data.urlSlug).push(folder);
  }

  if (!POST_TYPES.includes(data.type)) err(where, `type「${data.type}」不合法（${POST_TYPES.join(' / ')}）`);
  if (data.level !== undefined && !LEVELS.includes(data.level)) err(where, `level「${data.level}」不合法（${LEVELS.join(' / ')}）`);
  if (typeof data.title !== 'string' || !data.title.trim()) err(where, 'title 未填');
  if (typeof data.author !== 'string' || !data.author.trim()) err(where, 'author 未填');
  if (!Number.isInteger(data.readMin) || data.readMin <= 0) err(where, 'readMin 須為正整數');

  if (typeof data.excerpt !== 'string' || !data.excerpt.trim()) err(where, 'excerpt 未填');
  else if (data.excerpt.length > EXCERPT_MAX) err(where, `excerpt 超過 ${EXCERPT_MAX} 字（${data.excerpt.length} 字）`);

  checkCreatorRefs(where, data.creators, creators, { required: false, isDraft: draft });
  checkImage(where, full, 'cover', data.cover);
  if (typeof data.coverAlt !== 'string' || !data.coverAlt.trim()) err(where, 'coverAlt 未填');

  checkDateQuoted(where, raw, 'date', { required: true });
  checkDateQuoted(where, raw, 'updated');
  if (isDateStr(data.date) && isDateStr(data.updated) && data.updated < data.date) warn(where, `updated（${data.updated}）早於 date（${data.date}）`);

  const tools = checkVocab(where, 'tools', data.tools, TOOLS, 'src/data/tools.ts');
  checkToolMentions(where, tools, `${data.title ?? ''}\n${data.excerpt ?? ''}\n${body}`);
}

for (const [slug, folders] of urlSlugSeen) {
  if (folders.length > 1) err('posts', `urlSlug「${slug}」重複：${folders.join('、')}（路由會互相覆蓋）`);
}

/* ═══════════════════════════════════════════════════════════════
   events
   ═══════════════════════════════════════════════════════════════ */
const events = [];

for (const file of listMd(DIR.events)) {
  const id = basename(file, '.md');
  const where = `events/${file}`;
  const e = readEntry(join(DIR.events, file));
  if (e.parseError) {
    err(where, e.parseError);
    continue;
  }
  const { data, raw } = e;
  events.push({ id, data, draft: data.draft === true });

  if (data.slug !== id) err(where, `檔名「${id}」≠ slug「${data.slug ?? '（未填）'}」`);
  else if (!isKebab(id)) err(where, `slug「${id}」須為全小寫 kebab-case`);
  if (!EVENT_KINDS.includes(data.kind)) err(where, `kind「${data.kind}」不合法（${EVENT_KINDS.join(' / ')}）`);
  if (typeof data.title !== 'string' || !data.title.trim()) err(where, 'title 未填');
  if (typeof data.location !== 'string' || !data.location.trim()) err(where, 'location 未填（線上活動填「線上」）');
  if (typeof data.organizer !== 'string' || !data.organizer.trim()) err(where, 'organizer 未填');
  if (typeof data.summary !== 'string' || !data.summary.trim()) err(where, 'summary 未填');

  checkDateQuoted(where, raw, 'startDate', { required: true });
  checkDateQuoted(where, raw, 'endDate');
  checkDateQuoted(where, raw, 'deadline');
  if (isDateStr(data.startDate)) {
    if (isDateStr(data.endDate) && data.endDate < data.startDate) err(where, `endDate（${data.endDate}）早於 startDate（${data.startDate}）—— 時效性引擎會把活動判成已結束`);
    if (isDateStr(data.deadline) && data.deadline > data.startDate) warn(where, `deadline（${data.deadline}）晚於 startDate（${data.startDate}），請確認`);
  }

  checkImage(where, DIR.events, 'cover', data.cover);
  if (typeof data.coverAlt !== 'string' || !data.coverAlt.trim()) err(where, 'coverAlt 未填');
  if (!isHttp(data.officialUrl)) err(where, `officialUrl 不是 http(s) URL：${JSON.stringify(data.officialUrl)}`);
  if (data.isOnline === true && data.location !== '線上') warn(where, 'isOnline: true 但 location 不是「線上」');
  if (data.isOnline !== true && data.location === '線上') warn(where, 'location 為「線上」但沒有 isOnline: true');
  if (data.country !== undefined && !/^[A-Z]{2}$/.test(String(data.country))) err(where, `country「${data.country}」須為 ISO 3166-1 兩碼大寫（如 JP）`);
  if (data.currency !== undefined && !/^[A-Z]{3}$/.test(String(data.currency))) err(where, `currency「${data.currency}」須為 ISO 4217 三碼大寫（如 USD）`);
  if (data.country !== undefined && data.country !== 'TW' && data.currency === undefined && /\d/.test(String(data.fee ?? ''))) {
    warn(where, `海外活動（country: ${data.country}）的 fee 含金額但沒填 currency，Event schema 會標成 TWD`);
  }
}

/* ═══════════════════════════════════════════════════════════════
   輸出
   ═══════════════════════════════════════════════════════════════ */
const errors = problems.filter((p) => p.level === 'error');
const warnings = problems.filter((p) => p.level === 'warn');

console.log(`${bold('內容檢核')} ${dim('src/content/**')}`);
console.log(dim(`受控詞彙：${TOOLS.size} 個工具、${GENRES.size} 種作品類型、${CREATOR_CATEGORIES.size} 種創作者分類；enum：kind ${EVENT_KINDS.length}、type ${POST_TYPES.length}、level ${LEVELS.length}`));
console.log('');

for (const p of problems) {
  if (p.level === 'warn' && QUIET) continue;
  const mark = p.level === 'error' ? red('✗') : yellow('⚠');
  console.log(`${mark} ${cyan(p.where)}  ${p.msg}`);
}
if (problems.length && !(QUIET && !errors.length)) console.log('');

/* 統計 */
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const live = {
  creators: [...creators.values()].filter((c) => !c.draft),
  works: works.filter((w) => !w.draft),
  posts: posts.filter((p) => !p.draft),
  events: events.filter((e) => !e.draft),
};
const drafts = creators.size + works.length + posts.length + events.length - Object.values(live).reduce((n, a) => n + a.length, 0);
const interviews = live.posts.filter((p) => p.data.type === 'interview').length;
const evStatus = { upcoming: 0, ongoing: 0, past: 0 };
for (const ev of live.events) {
  const { startDate: s, endDate } = ev.data;
  if (!isDateStr(s)) continue;
  const last = isDateStr(endDate) ? endDate : s;
  evStatus[last < today ? 'past' : s > today ? 'upcoming' : 'ongoing']++;
}
const toolCounts = new Map();
for (const w of live.works) for (const t of new Set(Array.isArray(w.data.tools) ? w.data.tools : [])) toolCounts.set(t, (toolCounts.get(t) ?? 0) + 1);
const toolsUsed = [...toolCounts.keys()].filter((t) => TOOLS.has(t)).length;
const toolsWithPage = [...toolCounts].filter(([t, n]) => TOOLS.has(t) && n >= MIN_TOOL_WORKS).length;

console.log(
  `${bold('統計')} ${live.creators.length} 位創作者 · ${live.works.length} 部作品 · ${live.posts.length} 篇文章（訪談 ${interviews}／教學 ${live.posts.length - interviews}）· ` +
    `${live.events.length} 個活動（即將 ${evStatus.upcoming}／進行中 ${evStatus.ongoing}／已結束 ${evStatus.past}，以台北 ${today} 計）` +
    (drafts ? dim(` · 另有 ${drafts} 筆 draft`) : ''),
);
console.log(dim(`     工具：${toolsUsed}/${TOOLS.size} 個受控詞彙有作品，${toolsWithPage} 個達建頁門檻（≥ ${MIN_TOOL_WORKS} 部）`));
console.log('');

if (errors.length) {
  console.log(`${red('✗')} ${red(`${errors.length} 項錯誤`)}${warnings.length ? `、${yellow(`${warnings.length} 項警告`)}` : ''}${dim(' — 修正後再上稿')}`);
  process.exit(1);
}
if (warnings.length) console.log(`${green('✓')} 無錯誤，${yellow(`${warnings.length} 項警告`)}${QUIET ? dim('（拿掉 --quiet 看細節）') : ''}`);
else console.log(`${green('✓')} 全部通過`);
process.exit(0);
