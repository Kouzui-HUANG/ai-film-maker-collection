/**
 * 從文章 Markdown 原文抽取 FAQ 段落，供 build 時生成 FAQPage JSON-LD。
 * （原樣繼承 JP¥ ONLINE 的抽取器，只換答覆前綴的關鍵字）
 *
 * 站內 FAQ 版式：
 *   ## 常見問題 ／ ## FAQ ／ ## 讀者 Q&A ／ ### 名詞補充 …
 *   **問句（以？結尾、整段粗體）**
 *   **答**：（或 **編輯部**：、**作者**：、**A**：）答覆段落…
 *   ⚠ 冒號要放在粗體外：`**答：**答覆` 在 CommonMark 裡結尾 ** 緊接中文不算 right-flanking，
 *     會以字面星號渲染（check-integrity 會擋）。
 *
 * 收尾的 `> 📩` 互動邀請、`---` 之後的導覽都不屬於 Q&A，須排除。
 * 解析失敗寧可少收：湊不滿 2 組就不輸出 schema（buildFaqSchema 回 null）。
 */

export type FaqPair = { question: string; answer: string };

const FAQ_HEADING_RE = /^#{2,3}\s[^#\n]*(FAQ|Q&A|常見問題|快問快答|名詞補充|讀者來信|讀者最常|讀者可能|讀者對話|一定會問|新手常問)/;

/** 移除 Markdown 行內語法，輸出 JSON-LD 可用的純文字 */
function toPlainText(md: string): string {
  return md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 整段粗體且以問號結尾 ＝ 問句段落 */
function isQuestionParagraph(paragraph: string): boolean {
  if (!paragraph.startsWith('**') || !paragraph.endsWith('**')) return false;
  return /[？?]$/.test(toPlainText(paragraph));
}

const QUESTION_PREFIX_RE = /^Q\d*\s*[：:｜|]\s*/;
const ANSWER_PREFIX_RE = /^(?:答|作者|編輯部|圖鑑編輯部|A\d*)\s*[：:]\s*/;

export function extractFaq(body: string): FaqPair[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => FAQ_HEADING_RE.test(l));
  if (start === -1) return [];

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) || /^---\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const paragraphs = lines
    .slice(start + 1, end)
    .join('\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pairs: FaqPair[] = [];
  let question: string | null = null;
  let answerParts: string[] = [];

  const flush = () => {
    if (question && answerParts.length > 0) {
      const answer = toPlainText(answerParts.join(' ')).replace(ANSWER_PREFIX_RE, '');
      if (answer) pairs.push({ question, answer });
    }
    question = null;
    answerParts = [];
  };

  for (const p of paragraphs) {
    if (isQuestionParagraph(p)) {
      flush();
      question = toPlainText(p).replace(QUESTION_PREFIX_RE, '');
    } else if (question) {
      if (p.startsWith('>')) {
        const inner = p.replace(/^>\s?/gm, '').trim();
        if (ANSWER_PREFIX_RE.test(toPlainText(inner))) {
          answerParts.push(inner);
          continue;
        }
        flush();
        continue;
      }
      if (/^#/.test(p) || /^[-*]\s/.test(p)) {
        flush();
        continue;
      }
      answerParts.push(p);
    }
  }
  flush();

  return pairs;
}

/** 組 FAQPage JSON-LD；不足 2 組回傳 null */
export function buildFaqSchema(body: string): object | null {
  const pairs = extractFaq(body);
  if (pairs.length < 2) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

/* ── HowTo 抽取（教學文有明確步驟時） ───────────────────────────
 * 版式：`## 步驟` / `## 操作步驟` / `## Step by step` 之下的
 *   ### Step 1：xxx  或  ### 1. xxx  或  ### 步驟一：xxx
 *   段落…
 * 湊不滿 2 步就回 null（用 Article 即可）。
 */

export type HowToStep = { name: string; text: string };

const HOWTO_HEADING_RE = /^##\s[^#\n]*(步驟|Step|STEP|操作流程|實作流程|做法)/;
const STEP_HEADING_RE = /^###\s+(?:Step\s*\d+|STEP\s*\d+|步驟\s*[\d一二三四五六七八九十]+|\d+)[.：:、\s]*\s*(.+)$/;

export function extractHowToSteps(body: string): HowToStep[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => HOWTO_HEADING_RE.test(l));
  if (start === -1) return [];

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const steps: HowToStep[] = [];
  let current: HowToStep | null = null;
  for (const raw of lines.slice(start + 1, end)) {
    const m = raw.match(STEP_HEADING_RE);
    if (m) {
      if (current) steps.push(current);
      current = { name: toPlainText(m[1]), text: '' };
      continue;
    }
    if (current && raw.trim() && !raw.startsWith('#')) {
      const plain = toPlainText(raw.replace(/^>\s?/, '').replace(/^[-*]\s+/, ''));
      current.text = current.text ? `${current.text} ${plain}` : plain;
    }
  }
  if (current) steps.push(current);
  return steps.filter((s) => s.name);
}
