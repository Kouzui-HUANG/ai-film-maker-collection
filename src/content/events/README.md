# events/ — 比賽與活動（扁平單檔）

```
events/
├── <slug>.md              # frontmatter 見 src/content.config.ts 的 events schema
└── covers/<slug>.jpg      # 封面，建議 1600×900；不套濾鏡
```

- `kind`：competition / workshop / screening / talk / exhibition
- `startDate` / `endDate` / `deadline` 一律 "YYYY-MM-DD" 加引號
- upcoming / ongoing / past 由 build 時依台北日期自動判定（src/data/events.ts），
  過期的活動會自動從首頁與 /events/ 上半區消失 → 需要 GitHub Actions 每日重建
- 線上活動 `location: "線上"` 並設 `isOnline: true`
- 目前六筆為**示範資料**，正式上線前請整份替換
- alt 欄位（portraitAlt / thumbAlt / coverAlt）須描述實際圖片；換掉佔位圖時一併改寫
- 中文之間不留半形空格；子標題／單元用「・」或「：」
