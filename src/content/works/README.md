# works/ — 作品資料（扁平單檔）

```
works/
├── <slug>.md              # frontmatter 見 src/content.config.ts 的 works schema
└── thumbs/<slug>.jpg      # 縮圖，建議 1280×720（16:9）；全彩、不套濾鏡
```

- 檔名 = frontmatter `slug`（全小寫 kebab-case），建議 `<creator-slug>-<title-kebab>`
- `creators` 陣列填創作者資料夾名，第一位視為主創作者（麵包屑用）
- `genre` 單值、`tools` 陣列，都必須在 src/data/genres.ts / tools.ts 的受控詞彙裡
- 用 `node scripts/new-work.mjs <youtube-url> --creator <slug> --genre <slug>` 一鍵產骨架
- 目前的十四部為**示範資料**（影片為 Blender 基金會開放電影，CC-BY），正式收錄前請整份替換
- alt 欄位（portraitAlt / thumbAlt / coverAlt）須描述實際圖片；換掉佔位圖時一併改寫
- 中文之間不留半形空格；子標題／單元用「・」或「：」
