# 實作契約（給所有頁面／元件實作者）

設計文件：`docs/plans/2026-09-12-ai-film-creator-directory-design.md`（**先讀完再動手**）。
本檔是把設計文件落到程式碼層的約定：地基層已完成，頁面層照這份契約寫，才能拼得起來。

## 0. 已完成的地基（不要重寫，只能消費）

| 檔案 | 內容 |
|---|---|
| `site.config.mjs` | `SITE_ORIGIN` / `BASE_PATH` / `SITE_URL`（GitHub Pages 專案站會有 `/<repo>` base） |
| `astro.config.mjs` | `site` + `base`、sitemap（lastmod 對照表）、llms.txt 三件套 |
| `src/styles/global.css` | design tokens、reset、**共用 class**（見 §2） |
| `src/data/site.ts` | `SITE`、`href()`、`absUrl()`、`routes.*`、`absRoutes.*`、`PRIMARY_NAV` 等 |
| `src/data/tools.ts` | 工具受控詞彙 `TOOLS` / `TOOL_BY_SLUG` / `toolLabel()` / `toolHasPage()` / `MIN_TOOL_WORKS` / `TOOL_CATEGORY_LABEL` |
| `src/data/genres.ts` | 類型受控詞彙 `GENRES` / `GENRE_BY_SLUG` / `genreLabel()` / `genreIsIndexable()` / `MIN_GENRE_WORKS`；另有 `EVENT_KIND_LABEL` / `POST_TYPE_LABEL` / `LEVEL_LABEL` |
| `src/data/queries.ts` | **唯一的資料入口** `getSiteData()`（見 §3） |
| `src/data/events.ts` | 時效性引擎純函式：`fmtDate` / `fmtRange` / `countdownLabel` / `deadlineLabel` |
| `src/data/listings.ts` | `/works/` 捲動載入常數 `MORE_INITIAL=24` / `MORE_BATCH=12` / `MORE_CHUNK=24`、`WORKS_KEY`、`getMoreLists()` / `chunkCount()` / `chunkSlice()` |
| `src/data/faq.ts` | `buildFaqSchema(body)`（FAQPage）、`extractHowToSteps(body)`（HowTo） |
| `src/content.config.ts` | 四個 collection 的 schema（creators / works / posts / events） |
| `src/layouts/BaseLayout.astro` | 報頭、nav、footer、Organization + WebSite + BreadcrumbList schema 引擎 |
| `src/components/Analytics.astro` | GA4（`SITE.gaId` 空則不載） |
| `src/components/ShareLike.astro` | 按讚＋分享：`<ShareLike slug="work:<slug>" title={..} url={absUrl} location="work_footer" />` |
| `src/pages/robots.txt.ts` | robots 端點 |
| `src/content/**` | 實際收錄的創作者、作品、文章與活動（示範資料已於 2026-09-13 移除） |

## 1. 不可違反的規則

1. **站內連結一律經 `href()` 或 `routes.*`**（`import { href, routes } from '../data/site'`）。
   絕對不要寫死 `href="/creators/"` —— GitHub Pages 專案站有 `/<repo>` base，寫死會全站 404。
   `public/` 的靜態檔也一樣：`href('/og-default.png')`。
2. **JSON-LD 的 `url` / `@id` 一律用 `absRoutes.*` 或 `absUrl()`**；Person 的 `@id` 固定為 `absRoutes.creatorId(slug)` = `<site>/creator/<slug>/#person`。
3. **資料一律從 `getSiteData()` 拿**，不要自己 `getCollection`。它已做 draft 過濾、排序、反查、時效性計算。
4. **每個動態頁都要傳 `breadcrumbs` 給 BaseLayout**，且要與頁面可見的 `.crumbs` 一致（首頁之後的層級）。列表頁（/creators/ 等）可不傳，引擎會依 path 自動生成。
5. **BaseLayout 的 `title` 給 h1 文案、`seoTitle` 給 `<title>`/og**（雙標題制）；`description` 必填（≤ 160 字）。
6. **圖像濾鏡分區**只用 global.css 的 `.frame--portrait / --work / --post / --event`（或 `var(--filter-*)` token）：
   創作者肖像 grayscale(0.35)、**作品縮圖全彩**、文章封面 grayscale(0.5) hover 回 0、活動封面全彩。
7. **視覺紀律**：零圓角（≤2px）、1px 框線、硬陰影 `3px 3px 0`、明朝體標題、accent 每 viewport ≤ 3 處、中英之間半形空格、中文全形標點（中文之間不留空格，含模板插值 `{name}的作品`）。中黑點：含中文的字串用「・」(U+30FB)，純英文行用「·」(U+00B7)。
8. **圖片一律用 `<Image>`（astro:assets）**，指定 `width/height/widths/sizes`，`alt` 用 frontmatter 的 alt 欄位；首屏大圖 `loading="eager" fetchpriority="high"`，其餘 `lazy`。
9. **Scoped `<style>` 只寫該頁／該元件獨有的樣式**；頁首、麵包屑、chips、資料格網、表格、按鈕、空狀態等**直接用 global.css 的 class**（§2），不要重複定義同名 class。
10. **a11y**：語意標籤、`aria-label`、`aria-current="page"`、鍵盤可操作、`:focus-visible` 已在 global；互動元件的 `<script>` 用 Astro 的 `<script>`（TypeScript）而非 `is:inline`，除非需要 `define:vars`。
11. **不要引入任何 npm 套件或外部 CDN**（字型除外，已在 BaseLayout）。
12. 檔案只能動自己被分配的（見 §5）；需要地基層改動時，在最終回報中提出，不要自行修改 global.css / queries.ts / BaseLayout。

## 2. global.css 共用 class 速查

- 版面：`.container`、`.page`（padding）、`.page-inner`（max 880）、`.page-inner--wide`（max 1240）
- 頁首：`.page-head` > `.page-eyebrow`（英文 caps・中文，accent 色）+ `.rule-double` + `.page-title`(h1) + `.page-lead` + `.page-meta`
- 罫線：`.rule-double`、`.rule-hair`、`.rule-soft`、`.rule-dash`
- 區塊眉：`.section-head` > `<h2 class="section-eyebrow">`（`Works・作品`，**一律用 h2**，讓卡片內的 h3 不跳級）+ `.section-all`（`全部作品 →`）
- 麵包屑：`<nav class="crumbs" aria-label="麵包屑"><a href=..>首頁</a><span aria-hidden="true">／</span>…<span aria-current="page">…</span></nav>`
- 圖鑑語彙：`.chop`（`<span class="chop">收錄 <span class="chop__no">No.007</span></span>`）、`.no`（等寬編號）、`.listed-chip` / `.date-chip`、`.tag`、`.byline`
- chips：`<ul class="chips"><li><a class="chip" href=..>Runway</a></li><li><span class="chip chip--plain">Pika</span></li></ul>`；`.chip--accent`
- badge：`.badge`、`.badge--accent`、`.badge--outline`
- 資料格網：`<dl class="data-grid"><div class="data-grid__cell"><dt class="data-grid__label">收錄日</dt><dd class="data-grid__value">2026.06.01</dd></div>…</dl>`（`.data-grid__value--num` 等寬）
- 表格：`<div class="table-wrap"><table class="table">…`；`.table--tight`、`td.num`
- 圖框：`<figure class="frame frame--work"><Image …/></figure>`
- 按鈕：`.btn`、`.btn--accent`、`.btn--ghost`；下拉：`.select`
- 其他：`.back`、`.coming` / `.coming__kanji` / `.coming__lead`、`.prose`（文章內文）、`.visually-hidden`

## 3. `getSiteData()` 回傳形狀（`src/data/queries.ts`）

```ts
const d = await getSiteData();
d.today            // "YYYY-MM-DD"（台北）
d.creators         // Creator[] 依編號正序
d.works            // Work[]    依 sortDate 倒序
d.posts            // Post[]    依 date 倒序
d.events           // SiteEvent[]
d.upcomingEvents   // upcoming + ongoing，startDate 正序
d.pastEvents       // past，startDate 倒序
d.headline         // Work | null
d.toolCounts       // Map<toolSlug, 作品數>   → toolHasPage(d.toolCounts, slug)
d.genreCounts      // Map<genreSlug, 作品數>  → genreIsIndexable(d.genreCounts, slug)
d.creatorById / d.workById / d.postByUrlSlug / d.eventById
```

型別：
- `CreatorRef`：`{ id, no, name, nameEn?, slug, tagline, portrait, portraitAlt, region?, role?, tools, genres, listedAt }`
- `Creator = CreatorRef & { entry, data, works: Work[], posts: Post[], workCount, latestWork }`
- `Work`：`{ id, entry, data, creators: CreatorRef[], sortDate }`（`data` = works schema 欄位）
- `Post`：`{ id, entry, data, creators: CreatorRef[] }`
- `SiteEvent`：`{ id, entry, data, timing: { status, daysUntilStart, daysUntilDeadline, deadlinePassed, lastDay } }`

便利函式：`creatorsByListedAt(d)`、`creatorsByWorkCount(d)`、`worksByTool(d, slug)`、`worksByGenre(d, slug)`、`creatorsByTool(d, slug)`、`creatorsByGenre(d, slug)`、`postsByTool(d, slug)`、`siblingWorks(d, work, limit)`、`relatedWorksByTool(d, work, limit)`、`isoDuration(sec)`、`fmtDuration(sec)`、`parseVideoUrl(url)` → `{ provider, id, embedUrl, watchUrl }`。

內文渲染：`import { render } from 'astro:content'; const { Content } = await render(creator.entry);`（creators / posts / events 都可能有 body；works 沒有 body，只用 `synopsis` / `note`）。

## 4. 元件 props 契約（跨代理共用，簽名不可改）

```astro
<CreatorCard creator={Creator | CreatorRef} variant="row" | "tile" workCount?={number} />
  row : 肖像 56px 左、右邊 .no + 名字(+nameEn) + tagline + 工具 chips（最多 4 個，其餘 +N）
  tile: 肖像 4:5 上、下方 .no / 名字 / tagline（首頁「最新收錄」5 格用）
  肖像一律 .frame--portrait；整張卡是一個 <a href={routes.creator(slug)}>

<WorkCard work={Work} showCreators?={boolean=true} loading?="lazy"|"eager" />
  16:9 全彩縮圖(.frame--work) + 獎項狀態角標 + 標題 + 創作者名（多人全列、各自連到創作者頁）+ 年份・類型・時長
  根元素必須是 <article class="card" data-work-card>，內部固定 hook：
    .card__link  .card__figure img  .card__title  .card__creators  .card__meta
  （MoreList 會 clone 第一張當模板）

<AwardWorkCard work={Work} loading?="lazy"|"eager" />
  只給 /works/ 頁首得獎作品專區使用；呼叫端必須保證作品至少有一筆 awards.status = winner。
  桌機為橫式大卡，手機由頁面容器排成可左右捲動的卡片列。

<PostCard post={Post} variant="row" | "stacked" />
  封面 .frame--post + type badge（訪談/教學）+ 標題 + excerpt(2 行截) + 作者・日期・閱讀分鐘 + level

<EventCard event={SiteEvent} variant="row" | "compact" />
  封面 .frame--event + kind badge + 標題 + 日期範圍 + 地點 + 倒數/截止文案（用 events.ts 的 countdownLabel / deadlineLabel）
  compact：無封面，一列式（首頁近期活動 3 筆用）

<VideoFacade work={Work} />
  預設只渲染縮圖 + 播放鈕（<button aria-label="播放 <title>">），點擊才注入 <iframe>（embedUrl）。
  不支援的 provider：顯示「在外站觀看 ↗」連結。點擊時 window.gtag?.('event','video_play',{...})。

<MoreList listKey={string} works={Work[]} />
  只 SSR 前 MORE_INITIAL 張 WorkCard；其餘捲到底 fetch href(`/more/${listKey}/${n}.json`)。
  端點 src/pages/more/[key]/[page].json.ts 用 getImage() 走與 WorkCard 完全相同的轉檔參數。
```

## 5. 檔案歸屬

| 代理 | 擁有的檔案 |
|---|---|
| **creators** | `src/components/CreatorCard.astro`、`src/pages/creators/index.astro`、`src/pages/creator/[slug].astro` |
| **works** | `src/components/WorkCard.astro`、`src/components/VideoFacade.astro`、`src/components/MoreList.astro`、`src/pages/works/index.astro`、`src/pages/work/[slug].astro`、`src/pages/more/[key]/[page].json.ts` |
| **posts** | `src/components/PostCard.astro`、`src/pages/posts/index.astro`、`src/pages/post/[urlSlug].astro` |
| **events** | `src/components/EventCard.astro`、`src/pages/events/index.astro`、`src/pages/event/[slug].astro` |
| **static** | `src/pages/about.astro`、`src/pages/contact.astro`、`src/pages/privacy.astro`、`src/pages/404.astro`、`src/pages/sitemap.astro`、`src/pages/rss.xml.js` |
| **scripts** | `scripts/new-work.mjs`、`scripts/check-integrity.mjs`、`.github/workflows/deploy.yml`、`README.md` |
| **home+index**（第二階段，等前四位完成） | `src/pages/index.astro`、`src/pages/tool/[slug].astro`、`src/pages/genre/[slug].astro` |

## 6. Schema（JSON-LD）對照

| 頁 | schema（傳給 BaseLayout `schemas` prop） |
|---|---|
| `/creator/<slug>/` | `Person`（`@id` = creatorId、`name`、`alternateName`(nameEn)、`description`(tagline)、`image`、`url`、`jobTitle`(role join)、`homeLocation`(region)、`knowsAbout`(工具 label[])、`award`(awards 文字[])、`email`(有填才輸出)、`sameAs`[]）＋ `ItemList` of `VideoObject`（該創作者作品，每個 `creator: [{ '@id': creatorId }]`）；`ogType="profile"` |
| `/creators/` | `CollectionPage` + `mainEntity: ItemList` of `Person`（`{ '@type':'Person', '@id', name, url }`） |
| `/work/<slug>/` | `VideoObject`（`name` / `description`(synopsis) / `thumbnailUrl`(absolute) / `uploadDate`(releasedAt ?? `${year}-01-01`) / `duration`(isoDuration) / `embedUrl` / `sameAs`(watchUrl；**不填 contentUrl**，schema.org 定義它是媒體檔本身) / `genre` / `keywords`(工具) / `creator: [{'@type':'Person','@id':…,'name':…}]` / `publisher: {'@id': org}`）；`ogType="video.other"` |
| `/works/` `/tool/` `/genre/` | `CollectionPage` + `ItemList`（url + name） |
| 訪談 | `Article`（headline / description / author(Person or Organization) / datePublished / dateModified / image / publisher / `about: [{ '@id': creatorId }]` / inLanguage zh-Hant-TW / wordCount / timeRequired）＋ FAQPage（`buildFaqSchema`）；`ogType="article"` |
| 教學 | `extractHowToSteps(body).length >= 2` → `HowTo`（name / description / step[] HowToStep{name,text} / tool[] HowToTool{name}）否則 `Article`；FAQPage 照抽 |
| `/event/<slug>/` | `Event`（name / description / startDate / endDate / `eventAttendanceMode`(isOnline ? Online : Offline) / `eventStatus: EventScheduled` / `location`(isOnline ? VirtualLocation{url} : Place{name, address.addressCountry = `country` ?? TW}) / `organizer`(Organization{name}) / `offers`(fee: 免費→price 0；有數字→price+priceCurrency = `currency` ?? TWD；`url: officialUrl`，`availability`) / `image`） |

## 7. noindex 清單

只有 `/genre/<slug>/`（`!genreIsIndexable(...)` 時）與 `/404` 傳 `noindex`。**其餘全部 index**（含 `/tool/<slug>/`）。

## 8. 驗證方式

從專案根目錄跑 `npm run build`，必須零錯誤。build 後可 `grep -rl 'href="/creators/' dist/` 檢查有沒有漏掉 base（正確的連結會是 `/ai-film-maker-collection/creators/`）。
