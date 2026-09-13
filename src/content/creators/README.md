# creators/ — 創作者資料（一人一資料夾）

```
creators/<slug>/
├── index.md       # frontmatter 見 src/content.config.ts 的 creators schema
└── portrait.jpg   # 肖像，建議 800×1000（4:5）
```

- 資料夾名 = frontmatter `slug`（全小寫 kebab-case），作品的 `creators` 陣列填的就是這個
- `no` 為圖鑑編號，不可重複、不可跳號（`npm run check` 會驗）
- `spotlight: true` 全站同時只能有一位（首頁焦點）
- 日期一律加引號："2026-09-12"
- 不寫作品清單：創作者頁在 build 時反查 works
- 目前的六位為**示範資料**，正式收錄前請整份替換
- alt 欄位（portraitAlt / thumbAlt / coverAlt）須描述實際圖片；換掉佔位圖時一併改寫
- 中文之間不留半形空格；子標題／單元用「・」或「：」
