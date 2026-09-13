import type { APIRoute } from 'astro';
import { SITE } from '../data/site';

/**
 * robots.txt 以端點產生，才能帶正確的 Sitemap 絕對網址（origin 由 CI 決定）。
 * 注意：GitHub Pages 專案站（/<repo>/）的 robots.txt 不在網域根目錄，爬蟲不會讀；
 * 這種情況下 sitemap 請改在 Google Search Console 手動提交。
 */
export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /

# AI 爬蟲（明確允許，利於 LLM 訓練與 AI 搜尋索引 — 圖鑑型網站更該被 AI 引用）
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: cohere-ai
Allow: /

User-agent: Bytespider
Allow: /

Sitemap: ${SITE.url}/sitemap-index.xml

# LLM context file（依 llmstxt.org 規範，直接放在站根）
# ${SITE.url}/llms.txt
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
