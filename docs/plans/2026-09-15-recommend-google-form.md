# 推薦收錄 Google 表單・題目設計

對應 `/contact/` 的「推薦收錄」。設計目標：在不問創作工具的前提下，
讓編輯部從一份表單就能判斷**這個人的創作風格長什麼樣**，
並且拿到足以起草 `tagline`、`bio`、`categories`、`genres` 的原料。

## 設計原則

1. **不問工具。** 工具會過期、填答者也常填不準；收錄準則第 5 項所需的工具清單，
   改在「條目確認回信」階段向創作者本人核對，或由編輯部看作品自行判定。
2. **風格用選擇題問，不用開放題問。** 開放題只留三題，其餘一律點選，降低放棄率。
3. **兩軸交叉定位。** 「分類軸」（對應站內受控詞彙，可直接填欄位）
   ＋「風格軸」（形容詞與光譜，用來寫條目正文）。
4. **必填最小化。** 24 題中必填 13 題，其中 8 題是點一下就好的選擇題。
5. **順序照摩擦由低到高排。** 基本資料 → 選擇題 → 開放題 → 推薦人與同意事項。

## 表單設定

| 項目 | 設定 |
|---|---|
| 標題 | 台灣AI影視創作者圖鑑・推薦收錄 |
| 說明 | 讀者推薦與創作者自薦走同一條路，約 5 分鐘。編輯部依收錄準則審閱後以電子郵件回覆，一般七個工作日內。條目上線前，文字會先交由創作者本人確認。本站不收費、不接受付費收錄。 |
| 收集電子郵件 | 開（選「回應者輸入」，避免排除沒有 Google 帳號的人） |
| 進度列 | 開 |
| 允許編輯已提交的回應 | 開（方便補件） |
| 傳送回應副本給填答者 | 開 |
| 回應目的地 | 連到試算表 |
| 確認訊息 | 已收到，謝謝。編輯部會依收錄準則審閱，一般於七個工作日內回覆；未收錄也會回信說明。 |

---

## 區段一・基本資料

> 說明：先確認身分與作品連結。三部公開作品是收錄的硬門檻。

**1. 這份推薦是？**（單選，必填）
- 我推薦別人
- 我推薦我自己

**2. 創作者姓名或團隊名**（簡答，必填）
說明：以中文慣用名為主。

**3. 英文名、藝名或常用帳號名**（簡答，選填）

**4. 所在縣市**（簡答，必填）
說明：例如台北、台中、高雄。旅居海外但具台灣身分請填國家，條目地區會標示為「海外」。

**5. 社群連結**（段落，必填）
說明：YouTube、Instagram、Threads、X、Vimeo 或個人網站，一行一個，至少一個。

**6. 三部公開作品連結**（段落，必填）
說明：YouTube 或 Vimeo 網址，一行一個。需可公開觀看、且允許在第三方網站嵌入播放；
不接受私人連結、限時連結或下載檔。

---

## 區段二・創作風格

> 說明：這一段決定條目怎麼寫。沒把握的題目可以略過，編輯部會再看作品核對。

**7. 創作者類型分類**（複選，最多 3，必填）
→ 直接對應 `src/data/creator-categories.ts`
- 社群短片
- 行銷廣告
- 連續短劇
- 影視電影
- 音樂 MV
- 動畫漫畫
- 講座教學
- 模型訓練
- 地端工作流
- 其他

**8. 主要作品類型**（複選，最多 3，必填）
→ 直接對應 `src/data/genres.ts`
- 短片
- 廣告
- MV
- 紀錄片
- 動畫
- 實驗片
- 預告
- 其他

**9. 視覺調性**（複選，最多 3，必填）
說明：看完幾部作品後，最先浮現的畫面感覺。
- 寫實電影感（打光與鏡頭語言接近實拍）
- 動漫、二次元
- 3D 動畫或 CG 質感
- 手繪、插畫或水墨
- 復古膠片、VHS、老照片感
- 賽博、霓虹、科幻未來
- 超現實、拼貼、夢境感
- 恐怖、詭譎、暗黑
- 清新日常、生活感
- 廣告級精緻視覺

**10. 反覆出現的題材或母題**（複選，最多 3，必填）
說明：不是單一部作品，而是他一直在拍的東西。
- 台灣在地、民俗與宗教
- 都市生活與人際關係
- 科幻與近未來
- 奇幻、異世界、神話
- 恐怖與怪談
- 原創角色與 IP 世界觀
- 社會議題與時事
- 品牌、產品與商業訊息
- 音樂驅動的抽象視覺
- 歷史與懷舊

**11. 敘事光譜**（線性刻度 1–5，必填）
- 1：純視覺，幾乎沒有情節
- 5：有角色、有完整劇情

**12. 影像質感取向**（線性刻度 1–5，必填）
說明：沒有好壞，只是定位。
- 1：生猛手作，刻意保留生成感
- 5：商業精緻，接近傳統影視規格

**13. 聲音怎麼處理**（複選，選填）
- 角色對白為主
- 旁白或獨白
- 原創配樂
- 既有歌曲或音樂
- 環境音與音效設計是重點之一
- 幾乎無聲，純視覺

**14. AI 在製作流程中的位置**（單選，必填）
說明：對應收錄準則「AI 生成畫面佔主要比例」。
- 幾乎全片由 AI 生成
- AI 生成為主，少量實拍或手繪素材
- 實拍為主，AI 負責特效或補充畫面
- AI 主要用於分鏡、概念與前期視覺
- 重心在工作流、模型或工具開發本身

**15. 常見片長**（單選，選填）
- 30 秒以內（社群短影音）
- 30 秒到 2 分鐘
- 2 到 5 分鐘
- 5 到 15 分鐘
- 15 分鐘以上
- 連載集數制，每集固定長度

**16. 產出節奏**（單選，選填）
- 每週多次
- 大約每週一次
- 大約每月一次
- 不定期，有專案才產出
- 目前暫停或低度更新

---

## 區段三・用一段話說

> 說明：這三題是編輯部起草條目的原料，寫多寫少都可以。

**17. 用一句話形容這位創作者**（簡答，40 字內，必填）
說明：會成為條目標題句的參考。例如「把小說世界寫進工作流的敘事工程師」。

**18. 如果只能看一部，該看哪一部？為什麼？**（段落，必填）
說明：100–200 字。請寫作品名稱＋連結，以及你覺得它最厲害、最像他的地方。

**19. 和其他 AI 影像創作者最明顯的差別是什麼？**（段落，選填）
說明：100 字內。可以是題材、方法、風格潔癖，或某個只有他會做的事。

**20. 還有什麼是編輯部該知道的？**（段落，選填）
說明：得獎、影展入圍、放映、講座、出版、社群經營，或正在進行的長期企畫。

---

## 區段四・推薦人與同意事項

**21. 你的稱呼**（簡答，必填）

**22. 你和這位創作者的關係**（單選，必填）
- 就是本人
- 團隊成員
- 合作過
- 認識，但沒合作過
- 單純是觀眾

**23. 是否已告知對方你正在推薦？**（單選，選填）
說明：自薦者請略過。
- 已告知
- 尚未告知
- 不確定

**24. 確認事項**（複選，必填，請全部勾選）
- 我提供的作品連結為公開、且允許第三方網站嵌入播放
- 我理解收錄與否由編輯部依收錄準則審閱，填寫不代表一定收錄
- 我理解條目上線前會交由創作者本人確認，本站不收費、不接受付費收錄

---

## 待辦：文案要跟著改

`/contact/` 與 `/about/` 目前寫的是「本站不設表單」「沒有自助表單」，
`src/pages/contact.astro` 的檔頭註解也寫著「不做表單（設計文件 §10）」。
一旦這份表單上線，這三處都要改口，並在推薦收錄卡片加上表單連結（保留 mailto 作為備援）。

---

## 附錄・一鍵建立表單的 Apps Script

到 [script.google.com](https://script.google.com) 新增專案，貼上以下程式碼，
執行 `buildRecommendForm`，授權後在執行紀錄會看到編輯網址與填寫網址。

```javascript
/** 台灣AI影視創作者圖鑑・推薦收錄表單產生器 */
function buildRecommendForm() {
  var form = FormApp.create('台灣AI影視創作者圖鑑・推薦收錄');

  form.setDescription(
    '讀者推薦與創作者自薦走同一條路，約 5 分鐘。\n' +
    '編輯部依收錄準則審閱後以電子郵件回覆，一般於七個工作日內。\n' +
    '條目上線前，文字會先交由創作者本人確認。本站不收費、不接受付費收錄。'
  );
  form.setProgressBar(true);
  form.setAllowResponseEdits(true);
  try {
    form.setEmailCollectionType(FormApp.EmailCollectionType.RESPONDER_INPUT);
  } catch (e) {
    form.setCollectEmail(true);
  }
  form.setConfirmationMessage(
    '已收到，謝謝。編輯部會依收錄準則審閱，一般於七個工作日內回覆；未收錄也會回信說明。'
  );

  var atMost = function (n) {
    return FormApp.createCheckboxValidation().requireSelectAtMost(n).build();
  };

  /* ── 區段一・基本資料 ───────────────────────── */
  form.addPageBreakItem()
    .setTitle('基本資料')
    .setHelpText('先確認身分與作品連結。三部公開作品是收錄的硬門檻。');

  form.addMultipleChoiceItem()
    .setTitle('這份推薦是？')
    .setChoiceValues(['我推薦別人', '我推薦我自己'])
    .setRequired(true);

  form.addTextItem()
    .setTitle('創作者姓名或團隊名')
    .setHelpText('以中文慣用名為主。')
    .setRequired(true);

  form.addTextItem()
    .setTitle('英文名、藝名或常用帳號名');

  form.addTextItem()
    .setTitle('所在縣市')
    .setHelpText('例如台北、台中、高雄。旅居海外但具台灣身分請填國家，條目地區會標示為「海外」。')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('社群連結')
    .setHelpText('YouTube、Instagram、Threads、X、Vimeo 或個人網站，一行一個，至少一個。')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('三部公開作品連結')
    .setHelpText('YouTube 或 Vimeo 網址，一行一個。需可公開觀看、且允許在第三方網站嵌入播放；不接受私人連結、限時連結或下載檔。')
    .setRequired(true);

  /* ── 區段二・創作風格 ───────────────────────── */
  form.addPageBreakItem()
    .setTitle('創作風格')
    .setHelpText('這一段決定條目怎麼寫。沒把握的題目可以略過，編輯部會再看作品核對。');

  form.addCheckboxItem()
    .setTitle('創作者類型分類（最多選 3 項）')
    .setChoiceValues([
      '社群短片', '行銷廣告', '連續短劇', '影視電影', '音樂 MV',
      '動畫漫畫', '講座教學', '模型訓練', '地端工作流',
    ])
    .showOtherOption(true)
    .setValidation(atMost(3))
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('主要作品類型（最多選 3 項）')
    .setChoiceValues(['短片', '廣告', 'MV', '紀錄片', '動畫', '實驗片', '預告'])
    .showOtherOption(true)
    .setValidation(atMost(3))
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('視覺調性（最多選 3 項）')
    .setHelpText('看完幾部作品後，最先浮現的畫面感覺。')
    .setChoiceValues([
      '寫實電影感（打光與鏡頭語言接近實拍）',
      '動漫、二次元',
      '3D 動畫或 CG 質感',
      '手繪、插畫或水墨',
      '復古膠片、VHS、老照片感',
      '賽博、霓虹、科幻未來',
      '超現實、拼貼、夢境感',
      '恐怖、詭譎、暗黑',
      '清新日常、生活感',
      '廣告級精緻視覺',
    ])
    .setValidation(atMost(3))
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('反覆出現的題材或母題（最多選 3 項）')
    .setHelpText('不是單一部作品，而是他一直在拍的東西。')
    .setChoiceValues([
      '台灣在地、民俗與宗教',
      '都市生活與人際關係',
      '科幻與近未來',
      '奇幻、異世界、神話',
      '恐怖與怪談',
      '原創角色與 IP 世界觀',
      '社會議題與時事',
      '品牌、產品與商業訊息',
      '音樂驅動的抽象視覺',
      '歷史與懷舊',
    ])
    .setValidation(atMost(3))
    .setRequired(true);

  form.addScaleItem()
    .setTitle('敘事光譜')
    .setBounds(1, 5)
    .setLabels('純視覺，幾乎沒有情節', '有角色、有完整劇情')
    .setRequired(true);

  form.addScaleItem()
    .setTitle('影像質感取向')
    .setHelpText('沒有好壞，只是定位。')
    .setBounds(1, 5)
    .setLabels('生猛手作，保留生成感', '商業精緻，接近傳統影視規格')
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('聲音怎麼處理')
    .setChoiceValues([
      '角色對白為主',
      '旁白或獨白',
      '原創配樂',
      '既有歌曲或音樂',
      '環境音與音效設計是重點之一',
      '幾乎無聲，純視覺',
    ]);

  form.addMultipleChoiceItem()
    .setTitle('AI 在製作流程中的位置')
    .setHelpText('對應收錄準則「AI 生成畫面佔主要比例」。')
    .setChoiceValues([
      '幾乎全片由 AI 生成',
      'AI 生成為主，少量實拍或手繪素材',
      '實拍為主，AI 負責特效或補充畫面',
      'AI 主要用於分鏡、概念與前期視覺',
      '重心在工作流、模型或工具開發本身',
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('常見片長')
    .setChoiceValues([
      '30 秒以內（社群短影音）',
      '30 秒到 2 分鐘',
      '2 到 5 分鐘',
      '5 到 15 分鐘',
      '15 分鐘以上',
      '連載集數制，每集固定長度',
    ]);

  form.addMultipleChoiceItem()
    .setTitle('產出節奏')
    .setChoiceValues([
      '每週多次',
      '大約每週一次',
      '大約每月一次',
      '不定期，有專案才產出',
      '目前暫停或低度更新',
    ]);

  /* ── 區段三・用一段話說 ─────────────────────── */
  form.addPageBreakItem()
    .setTitle('用一段話說')
    .setHelpText('這三題是編輯部起草條目的原料，寫多寫少都可以。');

  form.addTextItem()
    .setTitle('用一句話形容這位創作者')
    .setHelpText('40 字內，會成為條目標題句的參考。例如「把小說世界寫進工作流的敘事工程師」。')
    .setValidation(
      FormApp.createTextValidation()
        .setHelpText('請控制在 40 字內。')
        .requireTextLengthLessThanOrEqualTo(40)
        .build()
    )
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('如果只能看一部，該看哪一部？為什麼？')
    .setHelpText('100–200 字。請寫作品名稱＋連結，以及你覺得它最厲害、最像他的地方。')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('和其他 AI 影像創作者最明顯的差別是什麼？')
    .setHelpText('100 字內。可以是題材、方法、風格潔癖，或某個只有他會做的事。');

  form.addParagraphTextItem()
    .setTitle('還有什麼是編輯部該知道的？')
    .setHelpText('得獎、影展入圍、放映、講座、出版、社群經營，或正在進行的長期企畫。');

  /* ── 區段四・推薦人與同意事項 ───────────────── */
  form.addPageBreakItem().setTitle('推薦人與確認事項');

  form.addTextItem()
    .setTitle('你的稱呼')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('你和這位創作者的關係')
    .setChoiceValues(['就是本人', '團隊成員', '合作過', '認識，但沒合作過', '單純是觀眾'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('是否已告知對方你正在推薦？')
    .setHelpText('自薦者請略過。')
    .setChoiceValues(['已告知', '尚未告知', '不確定']);

  form.addCheckboxItem()
    .setTitle('確認事項（請全部勾選）')
    .setChoiceValues([
      '我提供的作品連結為公開、且允許第三方網站嵌入播放',
      '我理解收錄與否由編輯部依收錄準則審閱，填寫不代表一定收錄',
      '我理解條目上線前會交由創作者本人確認，本站不收費、不接受付費收錄',
    ])
    .setValidation(FormApp.createCheckboxValidation().requireSelectAtLeast(3).build())
    .setRequired(true);

  Logger.log('編輯網址：' + form.getEditUrl());
  Logger.log('填寫網址：' + form.getPublishedUrl());
}
```
