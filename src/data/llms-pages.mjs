/**
 * llms-pages.mjs — llms.txt 頁面策展設定（astro.config.mjs 的 llmsTxtIntegration 讀這裡）
 *
 * 純 Node（不依賴 astro:content），直接掃 src/content/ 的 frontmatter：
 *   creators/<slug>/index.md → /creator/<slug>/
 *   works/<slug>.md          → /work/<slug>/（optional：只進 llms.txt 目錄，不進全文檔，250–500 筆太大）
 *   posts/<slug>/index.md    → /post/<urlSlug>/
 *   events/<slug>.md         → /event/<slug>/
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { SITE_URL } from '../../site.config.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CONTENT = join(__dirname, '..', 'content');

export const SITE_META = {
  name: '台灣AI影視創作者圖鑑',
  url: SITE_URL,
  description:
    '台灣AI影視創作者圖鑑是一份年鑑式網站，收錄以 AI 工具進行影視創作的台灣創作者：' +
    '每位創作者的定位、工具棧、作品、得獎紀錄與社群連結，並整理相關訪談、AI 影視教學與比賽活動資訊。',
};

export function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  try {
    return yaml.load(m[1]) ?? {};
  } catch {
    return {};
  }
}

function readDirEntries(dir, { folders }) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith('_') && !name.startsWith('.') && name !== 'README.md')
    .flatMap((name) => {
      const full = join(dir, name);
      if (folders) {
        if (!statSync(full).isDirectory()) return [];
        const idx = join(full, 'index.md');
        return existsSync(idx) ? [{ id: name, fm: parseFrontmatter(readFileSync(idx, 'utf-8')) }] : [];
      }
      if (!name.endsWith('.md')) return [];
      return [{ id: name.replace(/\.md$/, ''), fm: parseFrontmatter(readFileSync(full, 'utf-8')) }];
    })
    .filter((e) => e.fm && e.fm.draft !== true);
}

/** 各 collection 的公開條目（給 astro.config 的 sitemap lastmod 與 llms 共用） */
export function readContentIndex() {
  const creators = readDirEntries(join(CONTENT, 'creators'), { folders: true })
    .sort((a, b) => (a.fm.no ?? 0) - (b.fm.no ?? 0));
  const works = readDirEntries(join(CONTENT, 'works'), { folders: false })
    .sort((a, b) => String(b.fm.releasedAt ?? b.fm.year ?? '').localeCompare(String(a.fm.releasedAt ?? a.fm.year ?? '')));
  const posts = readDirEntries(join(CONTENT, 'posts'), { folders: true })
    .sort((a, b) => String(b.fm.date ?? '').localeCompare(String(a.fm.date ?? '')));
  const events = readDirEntries(join(CONTENT, 'events'), { folders: false })
    .sort((a, b) => String(b.fm.startDate ?? '').localeCompare(String(a.fm.startDate ?? '')));
  return { creators, works, posts, events };
}

const idx = readContentIndex();

export const SECTIONS = [
  {
    heading: '核心頁面',
    pages: [
      { path: '/', title: '首頁', note: '本期焦點創作者、最新收錄、最新作品、訪談與教學、近期活動' },
      { path: '/creators/', title: '創作者圖鑑總表', note: '一頁列完所有收錄創作者：編號、定位、主力工具、作品數' },
      { path: '/works/', title: '全部作品', note: '所有收錄作品，依發表時間排列' },
      { path: '/posts/', title: '訪談與教學', note: '創作者訪談與 AI 影視教學文章' },
      { path: '/events/', title: '活動與比賽', note: '即將舉行與過往的比賽、工作坊、放映、講座、展覽' },
      { path: '/about/', title: '關於圖鑑・收錄準則', note: '圖鑑定位、收錄準則、資料來源、授權聲明與退出機制' },
    ],
  },
  ...(idx.creators.length
    ? [{
        heading: '創作者',
        pages: idx.creators.map((c) => ({
          path: `/creator/${c.id}/`,
          title: `No.${String(c.fm.no ?? 0).padStart(3, '0')} ${c.fm.name ?? c.id}`,
          note: c.fm.tagline ?? '',
        })),
      }]
    : []),
  ...(idx.posts.length
    ? [{
        heading: '訪談與教學',
        pages: idx.posts.map((p) => ({
          path: `/post/${p.fm.urlSlug ?? p.id}/`,
          title: p.fm.title ?? p.id,
          note: p.fm.excerpt ?? '',
        })),
      }]
    : []),
  ...(idx.events.length
    ? [{
        heading: '活動與比賽',
        pages: idx.events.map((e) => ({
          path: `/event/${e.id}/`,
          title: e.fm.title ?? e.id,
          note: e.fm.summary ?? '',
          optional: true,
        })),
      }]
    : []),
  ...(idx.works.length
    ? [{
        heading: '作品',
        pages: idx.works.map((w) => ({
          path: `/work/${w.id}/`,
          title: w.fm.title ?? w.id,
          note: w.fm.synopsis ?? '',
          optional: true,
        })),
      }]
    : []),
];
