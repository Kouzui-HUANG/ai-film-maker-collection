# creators/ — 創作者資料（一人一資料夾）

```
creators/<slug>/
├── index.md       # frontmatter 見 src/content.config.ts 的 creators schema
└── portrait.jpg   # 肖像，建議 800×1000（4:5）
```

- 資料夾名 = frontmatter `slug`（全小寫 kebab-case），作品的 `creators` 陣列填的就是這個
- `no` 為圖鑑編號，不可重複、不可跳號（`npm run check` 會驗）
- `spotlight: true` 全站同時只能有一位（首頁焦點）
- `categories` 為創作者類型分類，使用 `src/data/creator-categories.ts` 的受控詞彙
- 日期一律加引號："2026-09-12"
- 不寫作品清單：創作者頁在 build 時反查 works
- 示範資料已於 2026-09-13 全數移除；目前為實際收錄的創作者
- alt 欄位（portraitAlt / thumbAlt / coverAlt）須描述實際圖片；換掉佔位圖時一併改寫
- 中文之間不留半形空格；子標題／單元用「・」或「：」
