#!/usr/bin/env node
/**
 * scripts/gen-placeholders.mjs — 補齊缺件的佔位圖
 *
 * 掃描 src/content/，凡是 frontmatter 指到的圖檔不存在，就用 sharp 產一張
 * 帶編號的純色漸層佔位圖（不載外部資源、不需要字型檔）：
 *   creators/<slug>/portrait.jpg      800×1000（4:5）
 *   works/thumbs/<slug>.jpg           1280×720（16:9）
 *   posts/<slug>/cover.jpg            1600×900
 *   events/covers/<slug>.jpg          1600×900
 * 另外補 public/logo.png（512²）與 public/og-default.png（1200×630）。
 *
 * 用法：
 *   node scripts/gen-placeholders.mjs                          # 只補缺的（不覆寫任何既有檔案）
 *   node scripts/gen-placeholders.mjs --force                  # 列出會被覆寫的檔案，但不動手
 *   node scripts/gen-placeholders.mjs --force --yes            # 真的重產（正式素材也會被蓋掉！）
 *   node scripts/gen-placeholders.mjs --force --yes --include-public   # 連 public/logo.png、og-default.png 一起
 *   node scripts/gen-placeholders.mjs --force --yes --only-public      # 只重產 public/ 品牌資產，不碰 src/content
 *
 * ⚠️ --force --yes 會覆寫既有檔案，包含已換成真實素材的肖像與縮圖。
 *    只要重產品牌資產時，請用 --only-public。
 */
import { readdirSync, readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname, sep } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'src', 'content');
const FORCE = process.argv.includes('--force');
const YES = process.argv.includes('--yes');
const INCLUDE_PUBLIC = process.argv.includes('--include-public') || process.argv.includes('--only-public');
/** --only-public：只重產 public/ 的品牌資產，完全不碰 src/content（避免覆寫真實肖像與縮圖） */
const ONLY_PUBLIC = process.argv.includes('--only-public');
/** --force 但沒 --yes 時，只列出將被覆寫的檔案 */
const wouldOverwrite = [];

const PALETTES = {
  portrait: [['#2e2620', '#6b5f52'], ['#26211c', '#5e564c'], ['#332b22', '#7a6a58']],
  work: [['#0f6b78', '#e9b44c'], ['#6a1b9a', '#ff7043'], ['#1b4d89', '#4fc3f7'], ['#b71c1c', '#ffb300'], ['#004d40', '#80cbc4'], ['#37474f', '#ff8a65']],
  post: [['#241e18', '#5168b4'], ['#1b1714', '#4a5568']],
  event: [['#1b1714', '#5168b4'], ['#241e18', '#94a9e6']],
};

function fm(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  try { return yaml.load(m[1]) ?? {}; } catch { return {}; }
}

function svg({ w, h, from, to, label, sub, kind }) {
  const ratio = Math.min(w, h) / 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <pattern id="grid" width="${ratio}" height="${ratio}" patternUnits="userSpaceOnUse">
      <path d="M ${ratio} 0 L 0 0 0 ${ratio}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#grid)"/>
  <rect x="${ratio * 0.6}" y="${ratio * 0.6}" width="${w - ratio * 1.2}" height="${h - ratio * 1.2}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="3"/>
  <text x="50%" y="${h / 2 - ratio * 0.2}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${ratio * 1.6}" fill="rgba(255,255,255,0.92)" letter-spacing="4">${label}</text>
  <text x="50%" y="${h / 2 + ratio * 1.1}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${ratio * 0.6}" fill="rgba(255,255,255,0.7)" letter-spacing="6">${sub}</text>
  ${kind ? `<text x="${w - ratio * 0.9}" y="${h - ratio * 0.9}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="${ratio * 0.45}" fill="rgba(255,255,255,0.5)" letter-spacing="3">${kind} · PLACEHOLDER</text>` : ''}
</svg>`;
}

async function write(file, opts, mime = 'jpeg') {
  if (existsSync(file)) {
    if (!FORCE) return false;
    if (file.includes(`${sep}public${sep}`) && !INCLUDE_PUBLIC) return false;
    if (!YES) {
      wouldOverwrite.push(file);
      return false;
    }
  }
  mkdirSync(dirname(file), { recursive: true });
  const buf = Buffer.from(svg(opts));
  const img = sharp(buf);
  if (mime === 'png') await img.png().toFile(file);
  else await img.jpeg({ quality: 82, mozjpeg: true }).toFile(file);
  return true;
}

const pick = (arr, i) => arr[i % arr.length];
let made = 0;

/* creators */
const cdir = join(CONTENT, 'creators');
if (!ONLY_PUBLIC && existsSync(cdir)) {
  for (const [i, folder] of readdirSync(cdir).filter((n) => !n.startsWith('.') && !n.startsWith('_')).entries()) {
    const idx = join(cdir, folder, 'index.md');
    if (!existsSync(idx) || !statSync(join(cdir, folder)).isDirectory()) continue;
    const data = fm(readFileSync(idx, 'utf-8'));
    const rel = String(data.portrait ?? './portrait.jpg').replace(/^\.\//, '');
    const [from, to] = pick(PALETTES.portrait, i);
    const no = String(data.no ?? i + 1).padStart(3, '0');
    if (await write(join(cdir, folder, rel), { w: 800, h: 1000, from, to, label: `No.${no}`, sub: 'CREATOR', kind: 'PORTRAIT' })) made++;
  }
}

/* works */
const wdir = join(CONTENT, 'works');
if (!ONLY_PUBLIC && existsSync(wdir)) {
  for (const [i, f] of readdirSync(wdir).filter((n) => n.endsWith('.md') && !n.startsWith('_') && n !== 'README.md').entries()) {
    const data = fm(readFileSync(join(wdir, f), 'utf-8'));
    const rel = String(data.thumb ?? `./thumbs/${f.replace(/\.md$/, '')}.jpg`).replace(/^\.\//, '');
    const [from, to] = pick(PALETTES.work, i);
    if (await write(join(wdir, rel), { w: 1280, h: 720, from, to, label: `WORK ${String(i + 1).padStart(2, '0')}`, sub: String(data.year ?? ''), kind: 'STILL' })) made++;
  }
}

/* posts */
const pdir = join(CONTENT, 'posts');
if (!ONLY_PUBLIC && existsSync(pdir)) {
  for (const [i, folder] of readdirSync(pdir).filter((n) => !n.startsWith('.') && !n.startsWith('_')).entries()) {
    const idx = join(pdir, folder, 'index.md');
    if (!existsSync(idx)) continue;
    const data = fm(readFileSync(idx, 'utf-8'));
    const rel = String(data.cover ?? './cover.jpg').replace(/^\.\//, '');
    const [from, to] = pick(PALETTES.post, i);
    const kind = data.type === 'tutorial' ? 'TUTORIAL' : 'INTERVIEW';
    if (await write(join(pdir, folder, rel), { w: 1600, h: 900, from, to, label: kind, sub: String(data.date ?? ''), kind: 'COVER' })) made++;
  }
}

/* events */
const edir = join(CONTENT, 'events');
if (!ONLY_PUBLIC && existsSync(edir)) {
  for (const [i, f] of readdirSync(edir).filter((n) => n.endsWith('.md') && !n.startsWith('_') && n !== 'README.md').entries()) {
    const data = fm(readFileSync(join(edir, f), 'utf-8'));
    const rel = String(data.cover ?? `./covers/${f.replace(/\.md$/, '')}.jpg`).replace(/^\.\//, '');
    const [from, to] = pick(PALETTES.event, i);
    if (await write(join(edir, rel), { w: 1600, h: 900, from, to, label: String(data.kind ?? 'EVENT').toUpperCase(), sub: String(data.startDate ?? ''), kind: 'EVENT' })) made++;
  }
}

/* public: logo + og */
if (await write(join(ROOT, 'public', 'logo.png'), { w: 512, h: 512, from: '#1b1714', to: '#5168b4', label: 'AI', sub: 'FILMMAKERS', kind: '' }, 'png')) made++;
if (await write(join(ROOT, 'public', 'og-default.png'), { w: 1200, h: 630, from: '#1b1714', to: '#5168b4', label: 'TAIWAN AI FILMMAKERS', sub: 'ANNUAL DIRECTORY', kind: '' }, 'png')) made++;

if (FORCE && !YES && wouldOverwrite.length) {
  console.log(`\x1b[33m!\x1b[0m --force 會覆寫以下 ${wouldOverwrite.length} 個既有檔案（含可能已換成正式素材的圖），確認後加 --yes 再跑：`);
  for (const f of wouldOverwrite) console.log(`   ${f.replace(ROOT + sep, '')}`);
}
console.log(`\x1b[32m✓\x1b[0m 佔位圖：新產 ${made} 張${FORCE && YES ? '（--force --yes）' : ''}`);
