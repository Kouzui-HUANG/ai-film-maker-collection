---
id: DESIGN-AIFMC-001
title: 台灣AI影視創作者圖鑑 — 設計文件
version: v1.0
status: draft
created: 2026-09-12
updated: 2026-09-12
基底: aai-jpyonline-com（JP¥ ONLINE，Astro 6 報紙風內容站）
changelog:
  - v1.0 (2026-09-12): 初版 — 資料模型、路由、schema、視覺層差異、建置順序
---

# 台灣AI影視創作者圖鑑 — 設計文件

## 0. 專案定位

收錄台灣 AI 影視創作者的**年鑑式**網站。內容包含創作者介紹、訪談、作品、比賽與活動資訊、AI 影視教學。

**這是「年鑑」不是「資料庫」。** 起步規模 20–50 位創作者、編輯部代管資料。這個前提決定了大量架構取捨——不要把為 532 篇文章設計的機制照搬到 50 筆條目上。

| 面向 | 決策 |
|---|---|
| 主體結構 | **creator-centric**：創作者是 first-class entity，訪談／教學／作品都關聯回人 |
| 收錄規模 | 起步 20–50 人，作品 250–500 部 |
| 資料維護 | 編輯部代管（Markdown + git），不做自助投稿表單 |
| 視覺調性 | 保留 JP¥ ONLINE 的結構骨架，換掉色彩層與圖像濾鏡策略 |
| 技術堆疊 | 沿用：Astro 6 static + 原生 CSS + Cloudflare Pages + Node ≥22.12 |

**明確不是什麼：**
- ❌ 作品投稿平台（不做上傳、不做會員）
- ❌ AI 工具評測站（工具是索引軸，不是主題）
- ❌ 新聞媒體（不追即時新聞，內容以人與作品為錨）

---

## 1. 與 JP¥ ONLINE 的關係

### 1-1 直接繼承（幾乎零改動）

| 資產 | 來源檔案 | 備註 |
|---|---|---|
| Astro 6 static + CF Pages 設定 | `astro.config.mjs` | sitemap filter 與 lastmod 對照表要改對象 |
| CSS token 系統與 reset | `src/styles/global.css` | 改色彩層，其餘保留 |
| BaseLayout schema 引擎 | `src/layouts/BaseLayout.astro` | Organization + WebSite + 自動 BreadcrumbList + `schemas` prop 疊加 |
| 雙標題制 | `title` / `seoTitle` | `<h1>` 用 title，`<title>`/og 用 seoTitle |
| 受控詞彙 + 建頁門檻 | `src/data/tags.ts` | 改寫成 `tools.ts` / `genres.ts` |
| 捲動分批載入 | `MoreList.astro` + `/more/[key]/[page].json.ts` + `listings.ts` | **只給 `/works/` 用**（250–500 筆） |
| llms.txt 三件套 | `astro.config.mjs` 的 `llmsTxtIntegration` | 圖鑑型網站更該被 AI 引用 |
| robots AI 爬蟲白名單 | `public/robots.txt` | 原樣搬 |
| GA4 自訂事件 | `src/components/Analytics.astro` | `outbound_click` / `cta_click` / `scroll_depth` |
| FAQ schema 抽取器 | `src/data/faq.ts` | 教學文天生適合 FAQ 版式 |
| 分享元件 | `src/components/ShareLike.astro` | GAS 按讚 + 五種分享 |

### 1-2 明確砍除（50 筆規模的負債）

| 機制 | 砍除理由 |
|---|---|
| 語意搜尋（768 維向量 + GAS 代理 + 前端 cosine） | 一頁列完 50 人比搜尋好用。**程式碼保留，等 100 人以上再開** |
| `popular.ts` 三層 GA fallback | 50 人不需要熱門排序 |
| 六大分類 × sectioned/simple 雙版型 | 圖鑑的索引軸是人與工具，不是主題分類 |
| `/category/<slug>/` 路由 | 整組拿掉 |
| `featured` / `categoryFeatured` hero 換頭條 | 簡化成單一「本期焦點創作者」 |
| `grayscale(0.85)` 全站套用 | 見 §5-2 分區策略 |

### 1-3 新寫（現站沒有的）

1. **時效性引擎** — events 在 build 時計算 `upcoming / ongoing / past`
2. **影片 lite facade** — 縮圖 + 播放鈕，點擊才載入 iframe
3. **`scripts/new-work.mjs`** — 從 YouTube URL 一鍵產出作品 md 骨架（見 §7）
4. **`/creators/` 圖鑑總表** — 一頁列完所有人的比較式表格

---

## 2. 資料模型

### 2-1 檔案結構

```
src/content/
├── creators/<slug>/              ~50 筆 · 一人一資料夾
│   ├── index.md
│   └── portrait.jpg
├── works/                        ~250–500 筆 · 扁平單檔
│   ├── <slug>.md
│   └── thumbs/<slug>.jpg
├── posts/<slug>/                 訪談 + 教學
│   ├── index.md
│   └── cover.jpg
└── events/
    ├── <slug>.md
    └── covers/<slug>.jpg
```

**為什麼 works 用扁平單檔而非資料夾：** 250–500 個資料夾在 Finder 與 GitHub 上都難以掃視，單檔 + 集中式縮圖資料夾才能批次處理（改圖、重新命名、找漏件）。creators 只有 50 筆，維持資料夾沒問題且能讓肖像與資料同層。

### 2-2 關聯方向：只做單向

**work → creator（單向），creator 不寫作品清單。**

creator 頁的作品列表在 build 時反查 `works` collection。雙向維護必然漂移（JP¥ ONLINE 的並行編輯互相覆蓋事故是同類問題），能單向就不要雙向。

`creators` 用**陣列**而非單一 reference，因為 AI 影視作品常是團隊產出。代價：不能用 `/creator/<x>/work/<y>/` 巢狀路由（得指定主創作者），因此走扁平 `/work/<slug>/`，麵包屑用 BaseLayout 現成的 `breadcrumbs` prop 手動指定。

### 2-3 content.config.ts

```ts
import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

/* ── 創作者：圖鑑主體 ───────────────────────────── */
const creators = defineCollection({
  loader: glob({
    pattern: ['**/*.md', '!**/README.md', '!**/_*.md'],
    base: './src/content/creators',
  }),
  schema: ({ image }) => z.object({
    no: z.number(),                        // 圖鑑編號，決定「收錄 No.007」印章
    name: z.string(),                      // 王小明
    nameEn: z.string().optional(),
    slug: z.string(),                      // URL 用，全小寫 kebab-case
    tagline: z.string(),                   // 一句話定位，40 字內
    bio: z.string(),                       // 簡介，150–250 字
    seoTitle: z.string().optional(),
    portrait: image(),
    portraitAlt: z.string(),
    tools: z.array(z.string()),            // 受控詞彙 → tools.ts
    genres: z.array(z.string()),           // 受控詞彙 → genres.ts
    region: z.string().optional(),         // 台北 / 台中 / 高雄 / 海外
    role: z.array(z.string()).optional(),  // 導演 / 剪輯 / 美術 / 配樂
    sameAs: z.object({                     // → Person schema 的 sameAs
      youtube: z.string().url().optional(),
      instagram: z.string().url().optional(),
      x: z.string().url().optional(),
      threads: z.string().url().optional(),
      vimeo: z.string().url().optional(),
      website: z.string().url().optional(),
    }).optional(),
    awards: z.array(z.object({             // 得獎與入圍
      year: z.number(),
      title: z.string(),
      result: z.string(),                  // 首獎 / 入圍 / 評審團獎
    })).optional(),
    listedAt: z.string(),                  // 收錄日 "YYYY-MM-DD"
    updatedAt: z.string().optional(),
    spotlight: z.boolean().optional(),     // 首頁焦點創作者（同時只有一位）
    draft: z.boolean().optional(),
  }),
});

/* ── 作品 ───────────────────────────────────────── */
const works = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/works' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    slug: z.string(),
    creators: z.array(reference('creators')),   // ★ 支援合作作品
    year: z.number(),
    releasedAt: z.string().optional(),          // "YYYY-MM-DD"
    genre: z.string(),                          // 受控詞彙 → genres.ts
    tools: z.array(z.string()),                 // 受控詞彙 → tools.ts
    durationSec: z.number().optional(),         // → VideoObject.duration
    videoUrl: z.string().url(),                 // YouTube / Vimeo
    thumb: image(),                             // "./thumbs/<slug>.jpg"
    thumbAlt: z.string(),
    synopsis: z.string(),                       // 100–200 字
    note: z.string().optional(),                // 製作手記／技術說明
    awards: z.array(z.string()).optional(),
    draft: z.boolean().optional(),
  }),
});

/* ── 訪談與教學（共用版型，type 分流） ──────────── */
const posts = defineCollection({
  loader: glob({
    pattern: ['**/*.md', '!**/README.md', '!**/_*.md'],
    base: './src/content/posts',
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    seoTitle: z.string().optional(),
    excerpt: z.string(),                        // ~150 字，硬上限 180
    type: z.enum(['interview', 'tutorial']),    // → Article vs HowTo schema
    urlSlug: z.string(),
    author: z.string(),
    date: z.string(),
    updated: z.string().optional(),
    cover: image(),
    coverAlt: z.string(),
    readMin: z.number(),
    creators: z.array(reference('creators')).optional(),  // 訪談對象
    tools: z.array(z.string()).optional(),      // 教學涉及的工具
    level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    draft: z.boolean().optional(),
  }),
});

/* ── 比賽與活動 ─────────────────────────────────── */
const events = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/events' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    slug: z.string(),
    kind: z.enum(['competition', 'workshop', 'screening', 'talk', 'exhibition']),
    startDate: z.string(),                      // "YYYY-MM-DD"
    endDate: z.string().optional(),
    deadline: z.string().optional(),            // 報名／投件截止
    location: z.string(),                       // 場地名稱，線上填「線上」
    isOnline: z.boolean().optional(),
    organizer: z.string(),
    officialUrl: z.string().url(),
    fee: z.string().optional(),                 // "免費" / "NT$1,200"
    cover: image(),
    coverAlt: z.string(),
    summary: z.string(),
    draft: z.boolean().optional(),
  }),
});

export const collections = { creators, works, posts, events };
```

> **免費的參照完整性檢查：** creator slug 打錯時，Astro 的 `reference()` 會在 build 時報錯，孤兒作品不會靜默上線。

### 2-4 受控詞彙

比照 `tags.ts` 的結構，但拆成兩支（工具與類型是正交的索引軸）：

```ts
// src/data/tools.ts
export interface ToolDef {
  slug: string;          // runway
  label: string;         // Runway
  category: 'video' | 'image' | 'audio' | 'edit' | 'other';
  vendor?: string;
  note: string;          // 該工具在影視流程中的角色
}
export const MIN_TOOL_WORKS = 2;   // 低於此不建 /tool/ 頁
```

```ts
// src/data/genres.ts — 短片 / 廣告 / MV / 紀錄片 / 動畫 / 實驗片 / 預告
```

⚠️ **從 JP¥ ONLINE 學到的教訓**（自動打標會誤植）：工具與類型一律由編輯部人工填寫，不做自動推斷。每個工具標籤上線前 grep 一次，確認該工具在作品內文真的出現過。

---

## 3. 路由

```
/                        首頁
/creators/               ★ 圖鑑總表 — 一頁列完所有人
/creator/<slug>/         ★ 創作者個人頁 — 核心資產
/works/                  全作品列表（捲動分批載入）
/work/<slug>/            單一作品
/posts/                  訪談與教學列表（type 切換）
/post/<urlSlug>/         單篇
/events/                 活動與比賽（upcoming / past 分區）
/event/<slug>/           單一活動
/tool/<slug>/            工具棧索引 — 該工具的創作者 + 作品
/genre/<slug>/           作品類型索引
/about /contact /privacy /404 /rss.xml /sitemap/
/more/works/<n>.json     捲動載入資料端點
```

### 3-1 三個關鍵決策

**① `/category/<slug>/` 整組拿掉。** 圖鑑的索引軸是「人」與「工具」，不是主題分類。

**② `/tool/<slug>/` 要 index，不要 noindex。** JP¥ ONLINE 把 `/tag/` 設為 `noindex, follow` 是因為那些頁只吃曝光不產點擊；但「Runway 台灣創作者」是有明確意圖的查詢，該搶。這也正好繞開 JP¥ 撞到的「定義型題目拿不到點擊」天花板——本站的天然查詢是**人名查詢**與**工具×類型組合查詢**，兩者都有明確意圖。

**③ `/creators/` 總表是最大流量磁鐵。** 對應 JP¥ ONLINE「東證上市50」那篇的打法，差別是這裡它是常設頁而非文章。

### 3-2 noindex 清單

只有 `/genre/<slug>/`（在條目不足時）與 `/404` 需要 noindex。**其餘全部 index**——這與 JP¥ ONLINE 大量 noindex 工具頁的策略相反，因為圖鑑的每個索引頁都對應真實搜尋意圖。

---

## 4. Schema（JSON-LD）

BaseLayout 的產生引擎原樣繼承，只換型別。

| 頁面 | schema |
|---|---|
| 每頁 | `Organization` + `WebSite` + `BreadcrumbList`（引擎零改動） |
| `/creator/<slug>/` | **`Person`** — `sameAs` 串社群、`knowsAbout` 掛工具棧、`award` 掛得獎<br>＋ `ItemList` of `VideoObject`（該創作者作品） |
| `/creators/` | `CollectionPage` + `ItemList` of `Person` |
| `/work/<slug>/` | **`VideoObject`** — `name` / `description` / `thumbnailUrl` / `uploadDate` / `duration` / `embedUrl` / `creator: [{@id: Person}]` |
| `/works/` `/tool/` `/genre/` | `CollectionPage` + `ItemList` |
| 訪談 | `Article` + `about: {@id: <creator>}` ← 把訪談綁回 Person entity |
| 教學 | **`HowTo`**（有明確步驟時）或 `Article`；FAQ 段落照抽 `FAQPage` |
| `/event/<slug>/` | **`Event`** — `startDate` / `endDate` / `location` / `organizer` / `offers` / `eventAttendanceMode` |

### 4-1 E-E-A-T 反轉

JP¥ ONLINE 是「一個編輯部實體撐 532 篇」（`/author/editorial/` 的 ProfilePage）。本站相反：

- **每個創作者是獨立 `Person` entity**，`@id` 為 `<site>/creator/<slug>/#person`
- 訪談的 `about`、作品的 `creator` 都用 `@id` 指回同一個 Person
- 圖鑑本身的權威來自**收錄的完整性**，不是單一作者的權威

`Person` + `sameAs` 對創作者本人有實質價值——有機會吃到 Google Knowledge Panel。**這是邀請創作者被收錄時最實際的說服點**：被收錄對他們自己的 SEO 有好處，不是單方面索取資料。

---

## 5. 視覺設計

### 5-1 保留（結構骨架）

- 細罫線系統：`.rule-double`（上 1px + 下 3px）／`.rule-hair`／虛線／米線
- 明朝體標題（Shippori Mincho → Noto Serif TC）、內文 serif 18px / line-height 2
- 英文 small caps 眉標 + 0.2–0.3em 字距
- **零圓角**（絕不超過 2px）、1px 框線、硬陰影 `3px 3px 0`
- `--container-max: 1240px` / `--gutter: 24px`（手機 16px）
- 9 級 type scale、四檔字重 400/500/700/900
- 段落／行高／中日英混排規則（中英間半形空格、中文全形標點）
- **「accent 色每 viewport ≤ 3 處」這條規則本身**——換色不換紀律，這是頁面不吵的關鍵

### 5-2 圖像濾鏡分區（最重要的視覺改動）

JP¥ ONLINE 全站套 `filter: grayscale(0.85) contrast(1.04)`。本站**分區處理**：

| 對象 | 濾鏡 |
|---|---|
| 創作者肖像 | `grayscale(0.35)` — 輕度，維持圖鑑統一感 |
| **作品縮圖／劇照** | **無濾鏡，一律全彩** |
| 訪談／教學封面 | `grayscale(0.5)`，hover 回 `0` |
| 活動封面 | 無濾鏡 |

**理由：** 劇照是創作者的門面，洗成黑白等於毀掉作品——這在邀請創作者加入時會是直接的阻力。

### 5-3 色彩

**已定案（2026-09-13）：「片基褐 Film Base」＋ 靛藍亮版。**
原本沿用 JP¥ ONLINE 的米白紙感已整組換掉，理由見下方。

```css
:root {
  /* 片基褐：膠卷片基與暗房安全燈的暖調深色 */
  --paper:        #1b1714;   /* 主背景  L* 8.1 */
  --paper-alt:    #120f0d;   /* 次層／凹陷 L* 4.5 */
  --paper-raised: #241e18;   /* 卡片／浮起 L* 11.8（取代舊的 --paper-white） */
  --ink:          #ece6dd;   /* 暖白，14.36:1 */
  --ink-soft:     #c7bfb3;   /*        9.78:1 */
  --muted:        #9a9188;   /*        5.75:1 */
  --rule:         #efe9e0;   /* 深底上罫線反轉成亮線 */
  --rule-soft:    #3e352c;
  --shadow:       #52463a;   /* 硬陰影：深底不能再用 ink，會過亮 */

  /* 識別色：藍晒靛亮版 */
  --accent:       #94a9e6;   /* 對底 7.70:1 */
  --accent-ink:   #5168b4;   /* 框線／陰影，對底 3.4:1 */
  --accent-lift:  #b7c5ef;   /* hover：深底上要更亮，不是更深 */
  --link:         #94a9e6;   /* 連結色獨立，不佔「≤ 3 處」額度 */
  --accent-wash:  rgba(148, 169, 230, 0.10);
}
```

**為什麼換掉米白：**
1. 舊的三個表面是三種紙——`#ffffff`(b* 0.0) / `#f6f3ec`(b* 3.7) / `#ebe7dc`(b* 5.8)，
   12 處純白卡片貼在微黃底上像白貼紙。
2. `L* 95.9` 幾乎貼著純白，全彩劇照沒有被裱起來；暗部戲在邊緣眩光，暖調戲被洗白。
3. 米白＋明朝體是古籍的語域，跟「AI 影視」正好相反。年鑑要的是檔案感，檔案感不必然等於泛黃。

**為什麼是靛藍：** 藍晒（cyanotype）是數位之前保存影像的工藝，壓在片基褐上就是藍晒印在深褐相紙。
舊的電影青 `#0f6b78` 被換掉有兩個硬理由：teal & orange 正好是當代電影最普遍的調色，
識別色不該是內容本身可能有的顏色；而且它在新次層上只有 4.33:1，掉出 WCAG AA。

**深色底的連帶改動（共約 42 處）：** 14 處硬陰影改用 `--shadow`、12 處 `background: var(--ink)` 逐一判斷
（反白 badge 照舊反轉，但 `.prose pre`／VideoFacade 信箱／側滑抽屜要改成凹陷或浮起的那一階）、
`.select` 箭頭 SVG 的硬編碼 stroke、`theme-color`、紙紋改成亮顆粒、大字號明朝體 900 → 800。

### 5-4 圖鑑語彙

| 元素 | 做法 |
|---|---|
| `chop` 印章 | 改成 **「收錄 No.007」認證章**——報紙語彙與圖鑑語彙在這裡合拍 |
| 資料欄位格網 | **真正做出「圖鑑感」的關鍵**：每個創作者頁跑同樣的欄位順序（編號／收錄日／主力工具／作品數／代表作／社群），讓讀者能橫向比較。吃現站已經很強的細線表格語彙 |
| `date-chip` | 改成 `listed-chip`（收錄日） |
| section eyebrow | 保留 `3px accent 直條 + 英文 caps + 中黑點 + 中文` |

---

## 6. 頁面設計

### 6-1 首頁

```
┌─ 報頭 nameplate + 主 nav ────────────────┐
│ SPOTLIGHT・本期焦點                       │
│   大圖 = 該創作者代表作劇照（全彩）        │
│   + 肖像小圖 + 名字 + tagline + 工具 chips │
├──────────────────────────────────────────┤
│ NEW・最新收錄     → 最近 5 位進入圖鑑的人 │
├──────────────────────────────────────────┤
│ WORKS・最新作品   → 最近 6 部（縮圖網格）  │
├──────────────────────────────────────────┤
│ READ・訪談與教學  → 最新 5 篇              │
├──────────────────────────────────────────┤
│ EVENTS・近期活動  → upcoming 最多 3 筆     │
│                      （過期自動消失）      │
└──────────────────────────────────────────┘
```

### 6-2 `/creators/` 圖鑑總表

**一頁列完 50 人，不分頁、不捲動載入。** 這是本站最重要的單一頁面。

- 版型：細線表格，每列 = `No. │ 肖像 40px │ 名字 + tagline │ 主力工具 chips │ 作品數`
- 排序：預設依編號；可切換「依收錄日」「依作品數」
- 篩選：純前端 filter（50 筆不需要後端），依工具 / 類型 / 地區
- 這裡的 UX 參考 JP¥ ONLINE 的 `archive.astro`（下拉篩選 + hover 預覽），但升級成多維度

### 6-3 `/creator/<slug>/` 創作者頁（核心資產）

```
麵包屑：首頁 › 創作者 › 王小明
┌──────────────────────────────────────────┐
│ [收錄 No.007 印章]                        │
│ 肖像（grayscale 0.35）                    │
│ H1 名字 ／ nameEn                         │
│ tagline                                   │
│ ── 資料格網（統一欄位順序）──              │
│   收錄日 │ 地區 │ 角色 │ 主力工具 │ 作品數 │
│ ── 社群連結列（sameAs）──                  │
├──────────────────────────────────────────┤
│ 簡介 bio                                  │
├──────────────────────────────────────────┤
│ WORKS・作品（全彩縮圖網格，反查 works）    │
├──────────────────────────────────────────┤
│ AWARDS・得獎與入圍（細線表格）             │
├──────────────────────────────────────────┤
│ READ・相關訪談與教學（反查 posts）         │
└──────────────────────────────────────────┘
```

### 6-4 `/work/<slug>/` 作品頁

- **影片用 lite facade**：預設只渲染縮圖 + 播放鈕，點擊才注入 iframe
- 作品資訊格網：年份 / 類型 / 時長 / 使用工具 / 創作者（多人時全列）
- synopsis + note（製作手記）
- 同創作者其他作品 / 同工具其他作品

### 6-5 `/events/` 時效性分區

- 上半 `UPCOMING`：依 `startDate` 正序，顯示倒數天數與報名截止
- 下半 `PAST`：依 `startDate` 倒序，摺疊顯示
- 每張卡片標示 `kind` badge（比賽 / 工作坊 / 放映 / 講座 / 展覽）

---

## 7. 必要的工具腳本

### 7-1 `scripts/new-work.mjs`（★ 關鍵基礎建設）

**沒有這支腳本，250–500 筆作品的手工建檔會拖垮編輯部。**

```
node scripts/new-work.mjs <youtube-url> --creator ming-wang --genre short-film
```

- 呼叫 YouTube oEmbed（**免 API key、免費**）：
  `https://www.youtube.com/oembed?url=<url>&format=json`
  回傳 `title` / `author_name` / `thumbnail_url`
- 自動下載縮圖存成 `src/content/works/thumbs/<slug>.jpg`
- 產出 `src/content/works/<slug>.md` 骨架，`synopsis` / `tools` 留空待人工補
- slug 規則：`<creator-slug>-<title-kebab>`，撞名加數字後綴

> Vimeo 也有對等的免 key oEmbed：`https://vimeo.com/api/oembed.json?url=<url>`

### 7-2 `scripts/check-integrity.mjs`

上稿前的機械檢核（比照 JP¥ ONLINE 的上稿防呆教訓）：

- 每個 `tools` / `genres` 值都存在於受控詞彙
- 每個工具標籤在對應作品的內文 grep 次數 ≥ 1（防誤植）
- `creators` reference 全部解析得到
- 編號 `no` 無重複、無跳號
- `spotlight: true` 全站僅一位
- frontmatter 日期欄位**有加引號**（JP¥ ONLINE 曾因未加引號被 YAML 當日期物件而 build 失敗）

### 7-3 每日重建（時效性引擎的必要條件）

⚠️ **靜態站陷阱：** build 時算出的「即將舉行」會過期。需要 GitHub Actions cron 或 CF Pages 排程**每日重建**，否則活動頁會停在上次 push 的狀態。

---

## 8. 建置順序

| 階段 | 範圍 | 產出 |
|---|---|---|
| **P0 骨架** | 從 `aai-jpyonline-com` 複製 Astro 設定、global.css、BaseLayout、Analytics；換色彩層與 nav | 可跑的空站 |
| **P1 創作者** | `creators` collection + `/creator/<slug>/` + `/creators/` 總表 + Person schema | 填入 5 位試水，驗證版型與 schema |
| **P2 作品** | `works` collection + `/work/<slug>/` + `/works/` + lite facade + VideoObject + `new-work.mjs` | 作品線可運作 |
| **P3 內容** | `posts`（訪談／教學）+ FAQ schema + 文章版型（繼承 `.prose`） | 內容線可運作 |
| **P4 活動** | `events` + 時效性引擎 + Event schema + 每日重建 cron | 全站功能完整 |
| **P5 索引** | `/tool/<slug>/` + `/genre/<slug>/` + sitemap + llms.txt + robots | SEO 層完整 |
| **P6 收錄** | 填滿 20–50 位創作者與其作品 | 正式發刊 |

**P1 先做 5 位就好。** 驗證版型與 schema 之後再量產，避免 50 筆資料建完才發現欄位設計不對。

---

## 9. 待決事項

| # | 項目 | 說明 |
|---|---|---|
| 1 | ~~**accent 色**~~ | ✅ 已定案 2026-09-13：片基褐底 `#1b1714` ＋ 靛藍亮版 `#94a9e6`，見 §5-3 |
| 2 | 站名與網域 | 影響 SITE meta、Organization schema、og 圖 |
| 3 | 收錄標準 | 什麼樣的創作者會被收錄？需要一份公開的收錄準則頁（也是 E-E-A-T 資產） |
| 4 | 作品授權 | 縮圖使用授權、影片嵌入的權利聲明 |
| 5 | 創作者退出機制 | 要求下架時的處理流程（URL 要 410 還是 301？） |
| 6 | 是否做電子報 | JP¥ ONLINE 有 `/newsletter/` 但未接金流／發送 |

---

## 10. Out of Scope（現階段明確不做）

- 創作者自助投稿／更新表單（起步由編輯部代管）
- 語意搜尋（程式碼保留，100 人以上再開）
- 會員 / 收藏 / 評論
- 作品上傳與代管（一律外連 YouTube / Vimeo）
- 熱門排序（GA4 三層 fallback）
- i18n（僅繁體中文）
- 動態 OG 圖生成

---

## 附錄：JP¥ ONLINE 檔案對應表

| 新站檔案 | 來源 | 改動幅度 |
|---|---|---|
| `astro.config.mjs` | 同名 | 中 — sitemap filter、lastmod 對照表換對象 |
| `src/styles/global.css` | 同名 | 小 — 換 accent，其餘保留 |
| `src/layouts/BaseLayout.astro` | 同名 | 中 — nav 結構換、breadcrumbLabels 換 |
| `src/components/Analytics.astro` | 同名 | 無 |
| `src/components/ShareLike.astro` | 同名 | 小 |
| `src/components/MoreList.astro` | 同名 | 無（只給 `/works/` 用） |
| `src/pages/more/[key]/[page].json.ts` | 同名 | 小 — 卡片欄位換 |
| `src/data/faq.ts` | 同名 | 無 |
| `src/data/tools.ts` | `src/data/tags.ts` | 大 — 結構照抄，內容全換 |
| `src/data/listings.ts` | 同名 | 大 — 改寫成關聯查詢 |
| `src/components/CreatorCard.astro` | `ArticleCard.astro` | 大 |
| `src/components/WorkCard.astro` | `ArticleCard.astro` | 大 |
| `src/components/VideoFacade.astro` | — | 新寫 |
| `scripts/new-work.mjs` | — | 新寫 |
