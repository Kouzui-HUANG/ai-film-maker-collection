import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 四個 collection：creators / works / posts / events
 *
 * 關聯方向只做單向：work → creator、post → creator。
 * creator 不寫作品清單，creator 頁在 build 時反查 works（見 src/data/queries.ts）。
 *
 * entry id 規則（generateId 統一去掉 /index 與 .md）：
 *   creators/<slug>/index.md  → id = <slug>
 *   works/<slug>.md           → id = <slug>
 *   posts/<slug>/index.md     → id = <slug>（路由用 urlSlug）
 *   events/<slug>.md          → id = <slug>
 * 作品 frontmatter 的 creators 陣列填的就是 creator 的資料夾名（= slug）。
 */

const stripId = ({ entry }: { entry: string }) =>
  entry.replace(/\/index\.md$/, '').replace(/\.md$/, '');

/* 日期一律 "YYYY-MM-DD" 字串（frontmatter 要加引號，否則 YAML 會轉成 Date 物件而 build 失敗） */
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期須為 "YYYY-MM-DD" 字串（記得加引號）');

/* ── 創作者：圖鑑主體 ───────────────────────────── */
const creators = defineCollection({
  loader: glob({
    pattern: ['**/*.md', '!**/README.md', '!**/_*.md'],
    base: './src/content/creators',
    generateId: stripId,
  }),
  schema: ({ image }) =>
    z.object({
      no: z.number().int().positive(),       // 圖鑑編號，決定「收錄 No.007」印章
      name: z.string(),                      // 王小明
      nameEn: z.string().optional(),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 須為全小寫 kebab-case'),
      tagline: z.string().max(40, 'tagline 40 字內'),
      bio: z.string(),                       // 簡介，150–250 字
      seoTitle: z.string().optional(),
      portrait: image(),
      portraitAlt: z.string(),
      tools: z.array(z.string()).min(1),     // 受控詞彙 → tools.ts
      genres: z.array(z.string()).min(1),    // 受控詞彙 → genres.ts
      region: z.string().optional(),         // 台北 / 台中 / 高雄 / 海外
      role: z.array(z.string()).optional(),  // 導演 / 剪輯 / 美術 / 配樂
      sameAs: z
        .object({
          youtube: z.string().url().optional(),
          instagram: z.string().url().optional(),
          x: z.string().url().optional(),
          threads: z.string().url().optional(),
          vimeo: z.string().url().optional(),
          website: z.string().url().optional(),
        })
        .optional(),
      awards: z
        .array(
          z.object({
            year: z.number().int(),
            title: z.string(),
            result: z.string(),              // 首獎 / 入圍 / 評審團獎
          }),
        )
        .optional(),
      listedAt: dateStr,                     // 收錄日
      updatedAt: dateStr.optional(),
      spotlight: z.boolean().optional(),     // 首頁焦點創作者（同時只有一位）
      draft: z.boolean().optional(),
    }),
});

/* ── 作品 ───────────────────────────────────────── */
const works = defineCollection({
  loader: glob({ pattern: ['*.md', '!README.md', '!_*.md'], base: './src/content/works', generateId: stripId }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 須為全小寫 kebab-case'),
      creators: z.array(reference('creators')).min(1),   // ★ 支援合作作品
      year: z.number().int(),
      releasedAt: dateStr.optional(),
      genre: z.string(),                                 // 受控詞彙 → genres.ts
      tools: z.array(z.string()).min(1),                 // 受控詞彙 → tools.ts
      durationSec: z.number().int().positive().optional(),
      videoUrl: z.string().url(),                        // YouTube / Vimeo
      thumb: image(),                                    // "./thumbs/<slug>.jpg"
      thumbAlt: z.string(),
      synopsis: z.string(),                              // 100–200 字
      note: z.string().optional(),                       // 製作手記／技術說明
      awards: z.array(z.string()).optional(),
      draft: z.boolean().optional(),
    }),
});

/* ── 訪談與教學（共用版型，type 分流） ──────────── */
const posts = defineCollection({
  loader: glob({
    pattern: ['**/*.md', '!**/README.md', '!**/_*.md'],
    base: './src/content/posts',
    generateId: stripId,
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      seoTitle: z.string().optional(),
      excerpt: z.string().max(180, 'excerpt 硬上限 180 字'),
      type: z.enum(['interview', 'tutorial']),           // → Article vs HowTo schema
      urlSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'urlSlug 須為全小寫 kebab-case'),
      author: z.string(),
      date: dateStr,
      updated: dateStr.optional(),
      cover: image(),
      coverAlt: z.string(),
      readMin: z.number().int().positive(),
      creators: z.array(reference('creators')).optional(), // 訪談對象
      tools: z.array(z.string()).optional(),               // 教學涉及的工具
      level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      draft: z.boolean().optional(),
    }),
});

/* ── 比賽與活動 ─────────────────────────────────── */
const events = defineCollection({
  loader: glob({ pattern: ['*.md', '!README.md', '!_*.md'], base: './src/content/events', generateId: stripId }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 須為全小寫 kebab-case'),
      kind: z.enum(['competition', 'workshop', 'screening', 'talk', 'exhibition']),
      startDate: dateStr,
      endDate: dateStr.optional(),
      deadline: dateStr.optional(),                      // 報名／投件截止
      location: z.string(),                              // 場地名稱，線上填「線上」
      isOnline: z.boolean().optional(),
      organizer: z.string(),
      officialUrl: z.string().url(),
      fee: z.string().optional(),                        // "免費" / "NT$1,200"
      cover: image(),
      coverAlt: z.string(),
      summary: z.string(),
      draft: z.boolean().optional(),
    }),
});

export const collections = { creators, works, posts, events };
