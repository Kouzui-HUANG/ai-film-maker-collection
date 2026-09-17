# 台灣AI影視創作者圖鑑

**收錄台灣 AI 影視創作者的年鑑式網站｜Astro 6 static × 原生 CSS × GitHub Pages**

## 專案定位

這是一份**年鑑，不是資料庫**。以創作者為主體（creator-centric），每位創作者是一個 first-class entity，訪談、教學、作品都關聯回人；起步規模 20–50 位創作者、250–500 部作品，內容由編輯部以 Markdown + git 代管，不做自助投稿、不做會員、不做工具評測。視覺沿用 JP¥ ONLINE 的報紙骨架（米白紙感、細罫線、明朝體、零圓角），換掉色彩層並把圖像濾鏡分區：創作者肖像輕度去色、**作品縮圖一律全彩**。

- 設計文件：[`docs/plans/2026-09-12-ai-film-creator-directory-design.md`](./docs/plans/2026-09-12-ai-film-creator-directory-design.md)（資料模型、路由、schema、視覺層、建置順序）
- 實作契約：[`docs/dev/CONTRACT.md`](./docs/dev/CONTRACT.md)（不可違反的規則、共用 class、資料形狀、元件 props）

## 技術堆疊

| 層級 | 選型 |
|---|---|
| 框架 | Astro 6（`output: 'static'`，Content Layer `glob` loader） |
| 樣式 | 原生 CSS + CSS variables（`src/styles/global.css`，無 framework） |
| 圖片 | `astro:assets`（build 時轉檔，`sharp`） |
| 部署 | GitHub Pages（GitHub Actions 建置，每日 cron 重建） |
| SEO | 每頁 JSON-LD（Person / VideoObject / Article / HowTo / Event）、sitemap（含 lastmod）、RSS、llms.txt 三件套 |
| Node | `>= 22.12.0`（見 `.node-version`） |

## 開發指令

```bash
npm install                       # 安裝依賴
npm run dev                       # 本地開發 http://localhost:4321/ai-film-maker-collection/
npm run build                     # 產出 dist/
npm run preview                   # 預覽 build 結果
npm run check                     # 內容檢核（上稿前必跑；有錯誤 exit 1）
npm run new-work -- <url> --creator <slug> --genre <slug>   # 從 YouTube / Vimeo 網址產作品骨架
npm run placeholders              # 補齊缺件的佔位圖（示範資料用）
```

本機 dev / build 預設用 `site.config.mjs` 內的 `https://hallucination28.com` + `/` base（與正式站一致）；要模擬其他部署位置：

```bash
SITE_ORIGIN=https://kouzui-huang.github.io BASE_PATH=/ai-film-maker-collection npm run build
```

## 目錄結構

```
ai-film-maker-collection/
├── site.config.mjs               # 部署位置（SITE_ORIGIN / BASE_PATH / SITE_URL）的單一真相來源
├── astro.config.mjs              # site + base、sitemap lastmod、llms.txt 生成
├── .github/workflows/deploy.yml  # GitHub Pages 部署 + 每日重建
├── docs/
│   ├── plans/                    # 設計文件
│   └── dev/CONTRACT.md           # 實作契約
├── public/                       # favicon、logo、og-default、.nojekyll、CNAME（正式網域）
├── scripts/
│   ├── new-work.mjs              # YouTube / Vimeo 網址 → 作品 md 骨架 + 縮圖
│   ├── check-integrity.mjs       # 上稿前檢核（受控詞彙、reference、編號、日期引號…）
│   └── gen-placeholders.mjs      # 佔位圖
└── src/
    ├── content.config.ts         # 四個 collection 的 schema
    ├── content/
    │   ├── creators/<slug>/      # index.md + portrait.jpg（一人一資料夾）
    │   ├── works/                # <slug>.md + thumbs/<slug>.jpg（扁平單檔）
    │   ├── posts/<slug>/         # index.md + cover.jpg（訪談與教學）
    │   └── events/               # <slug>.md + covers/<slug>.jpg
    ├── data/
    │   ├── site.ts               # 站台 meta、href() / routes.* / absRoutes.*、導覽
    │   ├── tools.ts              # 工具受控詞彙（TOOLS、MIN_TOOL_WORKS）
    │   ├── genres.ts             # 類型受控詞彙（GENRES）＋ 活動種類 / 文章類型 / 難度標籤
    │   ├── queries.ts            # 唯一的資料入口 getSiteData()：draft 過濾、排序、反查、時效性
    │   ├── events.ts             # 時效性引擎純函式（upcoming / ongoing / past、倒數文案）
    │   ├── listings.ts           # /works/ 捲動載入常數
    │   └── faq.ts                # FAQPage / HowTo schema 抽取器
    ├── layouts/BaseLayout.astro  # 報頭、nav、footer、Organization + WebSite + BreadcrumbList
    ├── components/               # CreatorCard / WorkCard / PostCard / EventCard / VideoFacade / MoreList / ShareLike
    ├── pages/                    # 路由（見設計文件 §3）
    └── styles/global.css         # design tokens + 共用 class
```

## 內容維護流程

所有內容都是 `src/content/` 下的 Markdown，frontmatter 欄位以 `src/content.config.ts` 為準。共通規則：

- **日期一律加引號**：`listedAt: "2026-09-12"`。沒加引號會被 YAML 當成 Date 物件，build 直接失敗。
- **受控詞彙**：`tools` 只能填 `src/data/tools.ts` 的 slug，`genre` / `genres` 只能填 `src/data/genres.ts` 的 slug。工具與類型一律人工填寫，不自動推斷；每個工具標籤都要在該條目內文真的提到（`npm run check` 會查）。
- **slug 全小寫 kebab-case**，且資料夾名／檔名必須等於 frontmatter 的 `slug`（posts 用 `urlSlug`）。
- **關聯只做單向**：作品與文章的 `creators` 陣列指向創作者資料夾名；創作者不寫作品清單，創作者頁在 build 時反查。
- 上稿前跑 `npm run check`，錯誤修完再 `npm run build`。`draft: true` 的條目不會上線，但 schema 仍須合法。

### 新增創作者

1. 建立 `src/content/creators/<slug>/`，放 `index.md` 與 `portrait.jpg`（建議 800×1000，4:5）。
2. `index.md` 的 frontmatter 照現有條目填：`no`（圖鑑編號，**不可重複、不可跳號**，接在現有最大號之後）、`name` / `nameEn` / `slug` / `tagline`（40 字內）/ `bio`（150–250 字）/ `seoTitle`（選填，45 字內；`<title>` 會再加站名後綴）/ `portrait` / `portraitAlt` / `tools` / `genres` / `region` / `role` / `sameAs`（社群連結，必須是完整 http(s) URL）/ `awards` / `listedAt`（收錄日）/ `updatedAt`（選填，資料更新日）。中文標題與名稱之間不留半形空格（子標題用「・」或「：」）。
3. 正文（`---` 之後）寫「創作方法」等段落，會顯示在創作者頁 bio 之下。
4. `npm run check`。

### 新增作品（用 `new-work.mjs`）

```bash
node scripts/new-work.mjs https://www.youtube.com/watch?v=XXXXXXXXXXX --creator lin-yu-chen --genre short-film
# 合作作品：--creator 可重複，第一位為主創作者（決定 slug 前綴與麵包屑）
# 選項：--released YYYY-MM-DD、--year 2026、--slug <自訂 slug>、--dry-run
```

腳本呼叫免 key 的 oEmbed 取得標題與頻道名，下載縮圖到 `src/content/works/thumbs/<slug>.jpg`（YouTube 取 maxresdefault，Vimeo 取 1280 寬），並寫出 `src/content/works/<slug>.md` 骨架。之後：

1. 補 `synopsis`（60–200 字）、`tools`（至少一個受控詞彙）、`thumbAlt`（描述實際縮圖）；視需要補 `durationSec` / `releasedAt` / `note` / `awards`。
2. 縮圖可換成正式劇照（16:9、全彩，不套濾鏡）。
3. 要設為首頁頭條時加 `headline: true`，**全站同時只能有一部**；換片時記得移除前一部的標記。都沒設時首頁會退回最新作品。
4. `npm run check`。骨架未補完時 `tools: []` 會被判為錯誤，`synopsis: "TODO"` 會出警告。

### 新增訪談／教學

1. 建立 `src/content/posts/<urlSlug>/`，放 `index.md` 與 `cover.jpg`（建議 1600×900）。必填欄位：`title` / `excerpt` / `type` / `urlSlug` / `author` / `date` / `cover` / `coverAlt` / `readMin`（閱讀分鐘，驅動「閱讀 N 分鐘」與 timeRequired）。
2. `type: "interview"`（Article schema，`about` 指回受訪創作者的 Person）或 `type: "tutorial"`（有 `## 操作步驟` + `### Step 1：…` 時自動產 HowTo schema，否則 Article）。
3. `excerpt` 硬上限 180 字；`date` / `updated` 加引號；訪談對象填 `creators`，教學涉及的工具填 `tools`，難度填 `level`。
4. FAQ 段落照版式寫（`## 常見問題` 之下 `**問句？**` 接 `**答**：答覆`——冒號放在粗體**外面**；`**答：**答覆` 在 Markdown 裡結尾星號緊接中文不會變粗體，`npm run check` 會擋），會自動抽成 FAQPage schema。

### 新增活動

1. 建立 `src/content/events/<slug>.md` 與 `covers/<slug>.jpg`（建議 1600×900，全彩）。
2. `kind`：`competition` / `workshop` / `screening` / `talk` / `exhibition`；`startDate` / `endDate` / `deadline` 加引號；線上活動 `location: "線上"` 並設 `isOnline: true`；`officialUrl` 必填。
   海外活動另填 `country`（ISO 3166-1 兩碼，如 `"JP"`）；`fee` 不是新台幣時填 `currency`（ISO 4217，如 `"USD"`）。兩者省略時 Event schema 會標成 TW／TWD。
3. upcoming / ongoing / past 由 build 時依台北日期自動判定，過期活動會自動從首頁與 `/events/` 上半區移到「已結束」——這也是為什麼要每日重建（見下節）。

## 部署到 GitHub Pages

### 第一次上線

專案目前不是 git repo。分支**必須叫 `main`**（deploy.yml 只在 push 到 main 時觸發，排程也只跑預設分支的 workflow）：

```bash
git init -b main
git add -A
git commit -m "init: 台灣AI影視創作者圖鑑"
# 到 GitHub 建一個空 repo（名稱決定網址：<owner>.github.io/<repo>/），然後：
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

push 之後到 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**，Actions 分頁會看到「Deploy to GitHub Pages」自動跑完，網址顯示在 deploy job 的 environment 連結。

部署由 `.github/workflows/deploy.yml` 處理：push 到 `main`、每天 UTC 00:00（台北 08:00）排程、或手動觸發時，依序 `npm ci` → 算出部署位置 → `npm run check` → `npm run build` → 上傳 `dist/` 到 GitHub Pages。第一次啟用請到 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。

### 三種位址型態

`astro.config.mjs` 與 `src/data/site.ts` 都從 `site.config.mjs` 讀 `SITE_ORIGIN` / `BASE_PATH`；deploy.yml 在 build 前依 repo 名稱把這兩個環境變數算好寫進 `$GITHUB_ENV`：

| 情境 | 判定 | `SITE_ORIGIN` | `BASE_PATH` |
|---|---|---|---|
| 專案站（預設） | 一般 repo 名稱 | `https://<owner>.github.io` | `/<repo>` |
| 使用者站 | repo 名稱為 `<owner>.github.io` | `https://<owner>.github.io` | `/` |
| 自訂網域 | Actions Variables 設了 `SITE_ORIGIN` | 該值 | `/` |

站內連結一律經 `href()` / `routes.*` 加 base，JSON-LD 與 canonical 用 `absUrl()` / `absRoutes.*`，所以三種型態不需要改任何頁面。

本站走第三種：正式網域 **`hallucination28.com`**（Squarespace Domains 註冊，DNS 指向 GitHub Pages）。設定分三處，缺一不可：

1. **Settings → Secrets and variables → Actions → Variables** 設 `SITE_ORIGIN=https://hallucination28.com`
2. `public/CNAME`（內容只有網域一行，Astro 原樣複製到 `dist/`）
3. **Settings → Pages → Custom domain** 填同一個網域，憑證簽發後開 **Enforce HTTPS**

DNS 側在 Squarespace 網域後台（`account.squarespace.com/domains` → 選網域 → DNS）：apex 四筆 A（`185.199.108~111.153`）＋四筆 AAAA（`2606:50c0:8000~8003::153`），`www` 的 CNAME 指 `kouzui-huang.github.io`。**MX / SPF / DKIM 不要動**——`ai_video@hallucination28.com` 靠那幾筆走 Google Workspace。

`public/.nojekyll` 是空檔，避免 GitHub Pages 用 Jekyll 處理而忽略 `_astro/` 資料夾。

### 為什麼每日重建

這是靜態站：活動的「即將舉行／進行中／已結束」是 build 當下算出來的。沒有排程重建，`/events/` 與首頁的近期活動會停在上次 push 的狀態，過期活動不會自動消失。cron 設在 UTC 00:00（台北 08:00），讓每天早上的站況以當天日期重算。

⚠ GitHub 會在 public repo **60 天沒有任何 commit** 後自動停用排程並寄通知。收到「scheduled workflow disabled」時，到 **Actions → Deploy to GitHub Pages → Enable workflow** 重新啟用（或推一個小 commit）。

## 內容現況

建站時的示範資料（六位虛構創作者、十四部作品、五篇文章、六個活動）已於 2026-09-13 全數移除，需要時可從 git 歷史取回（commit `af23822` 之前）。

目前 `src/content/` 只收實際的創作者、作品、文章與活動。`posts/` 或 `events/` 為空時，對應頁面會顯示「收錄中」空狀態，首頁的活動區塊則整區不渲染。

新增條目請照〈內容維護流程〉的步驟，並注意：

- **編號連續**：`no` 必須是 1..N 連續，新收錄接在現有最大號之後。
- **首頁頭條**：在作品設 `headline: true`，全站同時只能一部；都沒設時首頁自動取最新作品。
- **alt 要描述實際圖片**：`portraitAlt` / `thumbAlt` / `coverAlt` 換圖時一併改寫。

## 待決事項

| 項目 | 位置 | 說明 |
|---|---|---|
| GA4 Measurement ID | `src/data/site.ts` → `SITE.gaId` | 留空時 production build 不載入 gtag；填入後自動輸出 `outbound_click` / `cta_click` / `scroll_depth` / `video_play` 事件 |
| 作品按讚 API | `src/data/site.ts` → `SITE.likesApiUrl` | Google Apps Script Web App 端點；留空則按讚按鈕隱藏、分享功能照常 |
| ~~正式網域~~ | 已設為 `hallucination28.com`（`site.config.mjs` 預設值 + Actions Variable `SITE_ORIGIN` + `public/CNAME`） | 見〈三種位址型態〉。DNS 在 Squarespace 後台，憑證簽發後記得開 Enforce HTTPS |
| ~~聯絡信箱~~ | 已設為 `ai_video@hallucination28.com`（`src/data/site.ts` → `SITE.email`） | 用於聯絡頁、關於頁、隱私權頁的寄信連結與 Organization schema |
| 收錄準則、作品授權、退出機制 | 設計文件 §9 | 需要一份公開的收錄準則頁（`/about/`）與創作者要求下架時的處理流程 |
