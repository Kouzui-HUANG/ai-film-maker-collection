---
# 示範資料
title: "ComfyUI 影片工作流入門：把 FLUX 與 Wan 接成一條管線"
seoTitle: "ComfyUI 影片生成教學：FLUX 關鍵影格 + Wan 圖生影片的節點工作流"
excerpt: "寫給已經會用 ComfyUI 做圖、想開始做影片的人。以 FLUX 產關鍵影格、Wan 做圖生影片，講解節點如何串接、批次生成的參數曲線怎麼設，以及夜班工作室與黃志豪公開工作流的差異。"
type: "tutorial"
urlSlug: "tutorial-comfyui-video-pipeline"
author: "圖鑑編輯部"
date: "2026-08-28"
cover: "./cover.jpg"
coverAlt: "ComfyUI 節點工作流的截圖，左側是 FLUX 圖像節點，右側接到 Wan 影片節點"
readMin: 15
creators: ["huang-chih-hao", "studio-nightshift"]
tools: ["comfyui", "flux", "wan"]
level: "advanced"
---

## 這篇的前提

你已經在 ComfyUI 裡做過圖像生成，知道什麼是 checkpoint、CLIP、KSampler。這篇不解釋基礎，直接講**影片管線**：如何把 FLUX 的關鍵影格接到 Wan 的圖生影片節點，以及批次生成時參數該怎麼設。

工作流檔案可從黃志豪與夜班工作室的網站下載，本文以兩者的共通結構為主。

## 硬體需求

Wan 的 14B 模型需要 24GB 顯示記憶體才能穩定跑 5 秒片段；1.3B 版本 12GB 可跑，品質較低但適合測試管線。記憶體建議 64GB。

## 操作步驟

### Step 1：建立 FLUX 關鍵影格子圖

先建一組 FLUX 的圖像生成節點：載入模型、正向 prompt、KSampler、VAE 解碼。輸出接到「儲存圖片」與一個「傳遞影像」節點——後者是給下游影片節點用的。把這組節點框成群組，命名為「Keyframe」。

### Step 2：接上 Wan 圖生影片節點

安裝 Wan 的自訂節點後，新增「Wan 圖生影片」節點，將 Step 1 的影像輸出接到它的 `image` 輸入。影片 prompt 只描述動作與運鏡。設定片段長度 81 影格（約 5 秒）、解析度 832×480 起跳，穩定後再拉高。

### Step 3：把 seed 與 CFG 寫成曲線

批次生成的關鍵是讓每段片段都是前一段的「鄰居」。用「數值排程」類的節點，把 seed 設為固定值加上批次索引，CFG 從 5 緩慢漂到 7。這樣同一批 100 段片段會呈現連續的變化，剪接時容易找到接點。這是黃志豪《參數森林》的核心方法。

### Step 4：批次輸出與命名規則

輸出檔名帶上批次索引與 CFG 值，例如 `run03_017_cfg6.2.mp4`。篩選時可以直接從檔名回推參數，找到好的區間再局部重跑。

### Step 5：採集式剪接

把整批片段拉進剪接軟體，先依檔名排序看一遍，標記可用的段落。不要試圖控制每一段的內容——這個方法的重點是從大量片段裡「採集」，而不是精準生成。

## 兩份公開工作流的差異

| 項目 | 黃志豪 | 夜班工作室 |
|---|---|---|
| 圖像模型 | FLUX | Stable Diffusion + 自訓 LoRA |
| 影片模型 | Wan / Veo | Wan / Hunyuan Video |
| 角色一致性 | 不需要（非敘事） | LoRA |
| 批次策略 | 參數曲線 | 固定參數多 seed |
| 後製 | After Effects | DaVinci Resolve + Topaz |

## 常見問題

**Wan 跑一段 5 秒要多久？**

**答**：24GB 顯示卡上，14B 模型 832×480 約 4 到 6 分鐘；1.3B 模型約 1 分鐘。

**可以用雲端 GPU 嗎？**

**答**：可以，但夜班工作室刻意不用，原因是案子素材不能上傳到第三方伺服器。如果只是練習，租用雲端 GPU 是合理的起點。

**FLUX 與 Stable Diffusion 該選哪個？**

**答**：需要角色一致性選 Stable Diffusion（LoRA 生態成熟）；追求單張品質與文字渲染選 FLUX。
