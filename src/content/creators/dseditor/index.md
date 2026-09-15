---
no: 15
name: "松音"
nameEn: "dseditor"
slug: "dseditor"
tagline: "把小說世界寫進 ComfyUI 工作流的敘事工程師"
bio: "松音以 dseditor 名義活動，是從小說家、編劇跨入生成式 AI 的技術型影像創作者。2000 至 2010 年間曾以松音、久本治與 Windows98 等筆名出版約四十本小說；進入 AI 時代後，從替小說製作封面出發，逐步把 Stable Diffusion、FLUX、Wan、Hunyuan Video 與 Veo 接進 ComfyUI，發展成可重複、可教學也可開源的工作流。相較於以單一短片建立風格，他更重視角色世界觀、流程控制與長期 IP 經營；代表性創作包括 AI 少女企畫《小星糖的世界》與《科技魔法少女》，並持續開發分鏡、影片及設計工具。"
seoTitle: "松音 dseditor｜從小說敘事到 ComfyUI 工作流的 AI 影像創作者"
portrait: "./portrait.jpg"
portraitAlt: "松音 dseditor 的創作者肖像：留著深色長髮、配戴金框眼鏡，面向鏡頭的近身自拍"
tools: ["comfyui", "stable-diffusion", "flux", "wan", "hunyuan-video", "veo"]
genres: ["experimental", "animation", "short-film"]
categories: ["social-video", "animation-comics", "lecture-teaching", "local-workflow"]
region: "台灣"
role: ["AI 影像創作", "工作流設計", "講師", "小說家"]
sameAs:
  youtube: "https://www.youtube.com/@windowsxd01"
  threads: "https://www.threads.com/@dseditor"
  website: "https://dslab.tw/"
listedAt: "2026-09-15"
updatedAt: "2026-09-15"
---

## 從小說敘事走進生成影像

松音的起點不是影像模型，而是文字。他在 2000 至 2010 年間以松音、久本治與 Windows98 等筆名出版約四十本小說；[出版社作者介紹](https://lineanovel.com/%E6%9D%BE%E9%9F%B3-%E4%BD%9C%E5%93%81/)列出的代表系列包括《小惡魔》與《靈異辣妹快餐店》，題材多在恐怖、奇幻、異世界少女和角色價值觀的衝突之間移動。

生成式 AI 興起後，他最初只是想替自己的小說製作封面，後來逐步把圖像、短片、應用程式和遊戲組成新的「夢想空間」。這段轉向也決定了他的作者位置：相較於以幾部完整短片建立攝影風格的 AI 導演，他更像一名兼具敘事、工作流工程與教學能力的創作系統設計者。

## 把控制力做成工作流

松音的核心工具是 **ComfyUI**。他把 **Stable Diffusion**、**FLUX** 等圖像模型，以及 **Wan**、**Hunyuan Video**、**Veo** 等影片模型接進節點流程，處理角色與風格控制、線稿上色、物件遷移、手部修復、分鏡生成和影片串接。他在 [OpenArt 個人頁](https://openart.ai/workflows/profile/fish_intent_33)強調不用私有節點、以開放分享為基本原則；[GitHub 工作流庫](https://github.com/dseditor/ComfyuiWorkflows)則保留可下載、修改與重組的實作範例。

依其[公開履歷](https://dslab.tw/career)，他在 2024 年 5 月至 2026 年 2 月間曾取得 OpenArt ComfyUI 工作流排行榜第 12 名；外部訪談的節目介紹稱之為「全球工作流競賽第 12 名」。由於公開資料對活動性質的稱呼不同，本站將其記為平台工作流排行，不列入正式影展或創作獎項。

## 代表性作品與專案

### 《小星糖的世界》

[《小星糖的世界》](https://xingxingtang-world.vercel.app/)是目前最能概括松音創作觀的原創 AI IP。主角小星糖被設定為一名逐漸累積記憶的少女，透過日記、班級故事、與主人的對話及二十位同學的日常持續生長；角色也延伸到社群短影音與瀏覽器遊戲。它不是單一成片，而是一套把人物設定、連載敘事、生成影像和互動介面放在同一世界裡的長期企畫。[酷客會客室訪談](https://podcasts.apple.com/hk/podcast/%E9%85%B7%E5%AE%A2%E6%9C%83%E5%AE%A2%E5%AE%A4/id1822185407)亦將小星糖的創作動機與虛擬 IP 經營列為主要討論段落。

### 《科技魔法少女》

松音的個人履歷將《科技魔法少女》列為 2026 年 1 月 NVIDIA RTX AI PC Day 的展出作品。NVIDIA 官方活動頁可確認該活動於松菸文創園區舉行，但現有公開頁面沒有完整列出這件作品的片長、製作名單與技術細節，因此本站暫將它記為展演代表作，不延伸推測作品規格。

### AI 分鏡稿產生器

[AI 分鏡稿產生器](https://github.com/dseditor/AI-storyboard-generator)把松音的方法具體化成一套開源工具：先由語言模型將故事拆成分鏡，再以圖像模型生成各 Cut，接入 ComfyUI 製作鏡頭轉場，最後用 FFmpeg 合併影片。它顯示他的重點不只是「生成一張好看的圖」，而是讓故事從文字走到可反覆修改的成片流程。

### ComfyUI 工作流庫與實戰書

除了持續維護公開工作流，他於 2025 年出版電子書[《ComfyUI工作流程實戰》](https://www.sanmin.com.tw/product/index/015061679)，內容涵蓋環境建置、FLUX、生圖控制、修復放大與工作流模板。對松音而言，能讓其他創作者理解、複製並改造的方法，本身就是作品的一部分。

## 公開活動與創作位置

松音曾在 2024、2025 年 Stable Diffusion AI 年會分享「ComfyUI 實務」及「Vibe Coding＋ComfyUI 的創作流思維」，也在 AI 建築與設計研討會、校園課程與工作坊講授圖像、動態影像和自動化流程。他同時維護 [Medium 技術文章](https://medium.com/@dseditor)、[Facebook 社群頁](https://www.facebook.com/dseditor)與 YouTube 影片倉庫。

就目前可核對的資料，他最鮮明的身分不是傳統意義下擁有完整片單的 AI 電影導演，而是「敘事型 IP 開發者 × ComfyUI 工作流設計師 × AI 影像教育者」。作品偏向少女角色、動漫與魔法意象、日常情感和長期世界觀；技術面則持續追求可控、可重用與能實際落地的生成流程。

## 資料註記

本檔案依創作者官網、作品網站、GitHub、OpenArt、出版社作者頁、公開活動頁與訪談整理，最後查核於 2026 年 9 月 15 日。社群數字變動快速，未納入固定履歷；未能由作品頁或主辦單位交叉確認的資訊，均以「個人履歷記載」標示。
