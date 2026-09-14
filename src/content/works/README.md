# works/ — 作品資料（扁平單檔）

```
works/
├── <slug>.md              # frontmatter 見 src/content.config.ts 的 works schema
└── thumbs/<slug>.jpg      # 縮圖，建議 1280×720（16:9）；全彩、不套濾鏡
```

- 檔名 = frontmatter `slug`（全小寫 kebab-case），建議 `<creator-slug>-<title-kebab>`
- `creators` 陣列填創作者資料夾名，第一位預設視為主創作者；無公開主從分工時加 `equalCredit: true`
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
