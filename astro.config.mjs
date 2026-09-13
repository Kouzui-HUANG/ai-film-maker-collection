// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { SITE_ORIGIN, BASE_PATH, SITE_URL } from './site.config.mjs';
import { SITE_META, SECTIONS, readContentIndex } from './src/data/llms-pages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── llms.txt / llms-full.txt / llms-ctx.txt 自動生成（繼承自 JP¥ ONLINE）────

/** 從建置後的 HTML 提取純文字（保留換行語意） */
function stripHtml(html) {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let content = mainMatch ? mainMatch[1] : bodyMatch ? bodyMatch[1] : html;

  return content
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/(\n[ \t]*){3,}/g, '\n\n')
    .trim();
}

/** 將 path 轉成 dist 內的 HTML 檔路徑（dist 內不含 base） */
function pathToHtml(distDir, pagePath) {
  if (pagePath === '/') return join(distDir, 'index.html');
  return join(distDir, pagePath.replace(/^\//, ''), 'index.html');
}

function llmsTxtIntegration() {
  return {
    name: 'llms-txt',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const distDir = fileURLToPath(dir);
        const allPages = SECTIONS.flatMap((s) => s.pages);

        // 1. llms.txt（目錄）
        let llmsTxt = `# ${SITE_META.name}\n\n> ${SITE_META.description}\n\n`;
        for (const section of SECTIONS) {
          llmsTxt += `## ${section.heading}\n\n`;
          for (const page of section.pages) {
            llmsTxt += `- [${page.title}](${SITE_META.url}${page.path}): ${page.note}\n`;
          }
          llmsTxt += '\n';
        }
        writeFileSync(join(distDir, 'llms.txt'), llmsTxt.trimEnd() + '\n', 'utf-8');

        // 2. llms-full.txt（全文，optional 頁不進）
        let llmsFullTxt = `# ${SITE_META.name}\n\n> ${SITE_META.description}\n\n---\n\n`;
        let count = 0;
        for (const page of allPages) {
          if (page.optional) continue;
          const htmlPath = pathToHtml(distDir, page.path);
          if (!existsSync(htmlPath)) continue;
          const text = stripHtml(readFileSync(htmlPath, 'utf-8'));
          llmsFullTxt += `## ${page.title}\n\nURL: ${SITE_META.url}${page.path}\n\n${text}\n\n---\n\n`;
          count++;
        }
        writeFileSync(join(distDir, 'llms-full.txt'), llmsFullTxt.trimEnd() + '\n', 'utf-8');

        // 3. llms-ctx.txt（XML，CDATA 包覆）
        let llmsCtxTxt = '<documents>\n';
        let i = 1;
        for (const page of allPages) {
          if (page.optional) continue;
          const htmlPath = pathToHtml(distDir, page.path);
          if (!existsSync(htmlPath)) continue;
          const text = stripHtml(readFileSync(htmlPath, 'utf-8'));
          const safeText = text.replace(/]]>/g, ']]]]><![CDATA[>');
          llmsCtxTxt +=
            `<document index="${i}">\n` +
            `<source>${SITE_META.url}${page.path}</source>\n` +
            `<document_content>\n<![CDATA[\n${safeText}\n]]>\n</document_content>\n` +
            `</document>\n`;
          i++;
        }
        llmsCtxTxt += '</documents>\n';
        writeFileSync(join(distDir, 'llms-ctx.txt'), llmsCtxTxt, 'utf-8');

        console.log(`\x1b[32m✓\x1b[0m llms.txt / llms-full.txt / llms-ctx.txt 已生成（全文 ${count} 頁）`);
      },
    },
  };
}

// ── Sitemap <lastmod> 對照表 ─────────────────────────────────────────────
// 規則（由真到仿）：
//   - 創作者頁：updatedAt 優先，否則 listedAt
//   - 作品頁：releasedAt，否則不填
//   - 文章頁：updated 優先，否則 date
//   - 活動頁：不填（時效性頁每日重建，lastmod 反而失真）
//   - 首頁 / 總表 / 列表頁：對應 collection 最新日
//   - 其他靜態頁：對應 .astro 檔的 git last-commit 日（CI 沒有 git 歷史時 fallback 到 mtime）

const STATIC_PAGES = [
  ['/about/', 'src/pages/about.astro'],
  ['/contact/', 'src/pages/contact.astro'],
  ['/privacy/', 'src/pages/privacy.astro'],
];

function gitLastCommitDate(absPath) {
  try {
    const iso = execSync(`git log -1 --format=%cI -- "${absPath}"`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return iso ? iso.slice(0, 10) : null;
  } catch {
    return null;
  }
}

function buildLastmodMap() {
  const idx = readContentIndex();
  const map = new Map();
  const latestOf = (arr) => arr.filter(Boolean).sort().reverse()[0] ?? null;

  const creatorDates = [];
  for (const c of idx.creators) {
    const d = String(c.fm.updatedAt ?? c.fm.listedAt ?? '').slice(0, 10);
    if (!d) continue;
    map.set(`${SITE_URL}/creator/${c.id}/`, d);
    creatorDates.push(d);
  }

  const workDates = [];
  for (const w of idx.works) {
    const d = w.fm.releasedAt ? String(w.fm.releasedAt).slice(0, 10) : null;
    if (d) {
      map.set(`${SITE_URL}/work/${w.id}/`, d);
      workDates.push(d);
    }
  }

  const postDates = [];
  for (const p of idx.posts) {
    const d = String(p.fm.updated ?? p.fm.date ?? '').slice(0, 10);
    if (!d) continue;
    map.set(`${SITE_URL}/post/${p.fm.urlSlug ?? p.id}/`, d);
    postDates.push(d);
  }

  const lc = latestOf(creatorDates);
  const lw = latestOf(workDates);
  const lp = latestOf(postDates);
  if (lc) map.set(`${SITE_URL}/creators/`, lc);
  if (lw) map.set(`${SITE_URL}/works/`, lw);
  if (lp) map.set(`${SITE_URL}/posts/`, lp);
  const latestAll = latestOf([lc, lw, lp]);
  if (latestAll) {
    map.set(`${SITE_URL}/`, latestAll);
    map.set(`${SITE_URL}/sitemap/`, latestAll);
  }

  for (const [path, file] of STATIC_PAGES) {
    const abs = join(__dirname, file);
    if (!existsSync(abs)) continue;
    const lastmod =
      gitLastCommitDate(abs) || new Date(statSync(abs).mtimeMs).toISOString().slice(0, 10);
    map.set(`${SITE_URL}${path}`, lastmod);
  }

  return map;
}

const lastmodMap = buildLastmodMap();

// ── noindex 頁不進 sitemap ───────────────────────────────────────────────
// /genre/<條目不足>/ 與 /404 輸出 noindex（CONTRACT §7）；同時列在 sitemap 會被 Search Console 判為矛盾。
// 門檻邏輯只在頁面層算一次，這裡直接讀已產出的 HTML 判斷，不重複規則。
let outDir = join(__dirname, 'dist');

function captureOutDir() {
  return {
    name: 'capture-out-dir',
    hooks: {
      'astro:config:done': ({ config }) => {
        outDir = fileURLToPath(config.outDir);
      },
    },
  };
}

function pageIsNoindex(url) {
  if (!url.startsWith(SITE_URL)) return false;
  const file = pathToHtml(outDir, url.slice(SITE_URL.length) || '/');
  if (!existsSync(file)) return false;
  return /<meta name="robots" content="noindex/i.test(readFileSync(file, 'utf-8'));
}

// ── Markdown 表格：補 th scope="col"，並包進 .table-wrap（窄螢幕水平捲動，保留 <table> 語意） ──
function rehypeTables() {
  const walk = (node, parent, index) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'element' && node.tagName === 'table') {
      for (const section of node.children ?? []) {
        if (section.type !== 'element' || section.tagName !== 'thead') continue;
        for (const tr of section.children ?? []) {
          for (const th of tr.children ?? []) {
            if (th.type === 'element' && th.tagName === 'th') {
              th.properties = { ...(th.properties ?? {}), scope: th.properties?.scope ?? 'col' };
            }
          }
        }
      }
      if (parent && !(parent.type === 'element' && parent.tagName === 'div' && String(parent.properties?.className ?? '').includes('table-wrap'))) {
        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-wrap'] },
          children: [node],
        };
      }
      return;
    }
    (node.children ?? []).forEach((child, i) => walk(child, node, i));
  };
  return (tree) => walk(tree, null, 0);
}

// https://astro.build/config
export default defineConfig({
  site: SITE_ORIGIN,
  base: BASE_PATH,
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  markdown: {
    rehypePlugins: [rehypeTables],
  },
  integrations: [
    captureOutDir(),
    llmsTxtIntegration(),
    sitemap({
      // /more/works/<n>.json 是捲動載入的資料端點；404 與 rss 不是可讀頁面
      filter: (page) =>
        // sitemap 套件在有 base 時會多吐一筆「無結尾斜線的站根」，與 `${SITE_URL}/` 重複
        page !== SITE_URL &&
        !page.endsWith('/rss.xml') &&
        !page.includes('/more/') &&
        !page.endsWith('/404/') &&
        !page.endsWith('/404.html'),
      serialize(item) {
        if (pageIsNoindex(item.url)) return undefined; // 回傳 undefined = 排除該筆
        const lastmod = lastmodMap.get(item.url);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
  ],
});
