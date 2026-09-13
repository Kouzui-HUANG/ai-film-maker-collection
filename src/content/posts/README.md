# posts/ — 訪談與教學（一篇一資料夾）

```
posts/<slug>/
├── index.md     # frontmatter 見 src/content.config.ts 的 posts schema
└── cover.jpg    # 封面，建議 1600×900；grayscale(0.5)，hover 回全彩
```

- `type: interview`（→ Article schema + about 指回 Person）或 `type: tutorial`（→ HowTo 或 Article）
- 路由用 `urlSlug`，資料夾名建議與之相同
- 訪談對象填 `creators`；教學涉及的工具填 `tools`（受控詞彙）
- FAQ 版式（自動抽成 FAQPage schema）：`## 常見問題` 之下，`**問句？**` 接 `**答**：答覆`（冒號在粗體外；`**答：**答覆` 會以字面星號渲染）
- HowTo 版式（教學文自動抽成 HowTo schema）：`## 操作步驟` 之下，`### Step 1：xxx` 各步驟
- 示範資料已於 2026-09-13 全數移除；目前尚無文章（`/posts/` 會顯示空狀態）
- alt 欄位（portraitAlt / thumbAlt / coverAlt）須描述實際圖片；換掉佔位圖時一併改寫
- 中文之間不留半形空格；子標題／單元用「・」或「：」
