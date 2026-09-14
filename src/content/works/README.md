# works/ — 作品資料（扁平單檔）

```
works/
├── <slug>.md              # frontmatter 見 src/content.config.ts 的 works schema
└── thumbs/<slug>.jpg      # 縮圖，建議 1280×720（16:9）；全彩、不套濾鏡
```

- 檔名 = frontmatter `slug`（全小寫 kebab-case），建議 `<creator-slug>-<title-kebab>`
- `creators` 陣列填創作者資料夾名，第一位預設視為主創作者；無公開主從分工時加 `equalCredit: true`
- `headline: true` 全站同時只能有一部；該作品會成為首頁頭版頭條
- `genre` 單值、`tools` 陣列，都必須在 src/data/genres.ts / tools.ts 的受控詞彙裡
- 用 `node scripts/new-work.mjs <youtube-url> --creator <slug> --genre <slug>` 一鍵產骨架
- 示範資料已於 2026-09-13 全數移除；目前為實際收錄的作品
- alt 欄位（portraitAlt / thumbAlt / coverAlt）須描述實際圖片；換掉佔位圖時一併改寫
- 中文之間不留半形空格；子標題／單元用「・」或「：」

## 獎項紀錄

`awards` 使用結構化資料，`status` 必須是 `winner`、`finalist`、`selection` 之一：

```yaml
awards:
  - year: 2026
    title: "台北 AI 影像節短片競賽"
    result: "評審團獎"
    status: "winner"
```

- `winner`：取得名次或實際獎項，會進 `/works/` 頁首的得獎作品專區
- `finalist`：入圍、決賽或短名單
- `selection`：影展官方入選
- 同一部作品可填多筆；frontmatter 順序也是頁首卡片選擇主要得獎紀錄時的優先序

## 媒體報導

`press` 收外部媒體報導這部作品的連結，顯示在作品頁「媒體報導」區，並掛進 VideoObject 的 `subjectOf`：

```yaml
press:
  - outlet: "公視新聞網"
    title: "台灣創作者AI短片《借來的殼》獲西班牙鳳梨動畫節獎項"
    url: "https://news.pts.org.tw/article/817618"
    date: "2026-07-14"
```

- `title` 照原標抄，不改寫語句；只把媒體自己加的半形空格與頻道／日期後綴清掉
- `outlet` 用媒體全名；同一家的文字稿與新聞節目分開寫（公視新聞網／公視晚間新聞）
- `date` 為刊出日，一樣要加引號；查不到就整個欄位留空
- 依刊出日新到舊排；同一則新聞的文字稿與新聞影片可各列一筆，標題後綴註明
- 只收第三方報導，創作者自己的說明欄、社群貼文不算
- 沒有 `press` 的作品，資料格網的「媒體報導」顯示「—」，不會多出空白區塊
