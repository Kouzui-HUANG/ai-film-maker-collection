/**
 * Site metadata and navigation.
 * Single source of truth for site-wide strings and structure.
 *
 * 部署位置（origin / base）來自根目錄 site.config.mjs，
 * 讓 astro.config.mjs 與這裡讀同一份值。
 */
import { SITE_ORIGIN, BASE_PATH, SITE_URL } from '../../site.config.mjs';

export const SITE = {
  name: '台灣AI影視創作者圖鑑',
  nameEn: 'TAIWAN AI FILMMAKERS',
  tagline: '收錄台灣 AI 影視創作者的年鑑',
  /** 報頭副標（nameplate 下方） */
  taglineSub: '創作者・作品・訪談・教學・活動',
  /** 長版站台描述：llms.txt 開頭引言、RSS <description>、Organization schema */
  description:
    '台灣AI影視創作者圖鑑是一份年鑑式網站，收錄以 AI 工具進行影視創作的台灣創作者：' +
    '每位創作者的定位、工具棧、作品、得獎紀錄與社群連結，並整理相關訪談、AI 影視教學與比賽活動資訊。',
  /** 站台根 origin（不含 base） */
  origin: SITE_ORIGIN,
  /** base path：'/' 或 '/<repo>'（GitHub Pages 專案站） */
  base: BASE_PATH,
  /** 完整站台 URL（含 base，無結尾斜線）：絕對連結、canonical、JSON-LD @id 一律用這個 */
  url: SITE_URL,
  locale: 'zh-Hant',
  /** 編輯部聯絡信箱（contact 頁與 Organization schema） */
  email: 'ai_video@hallucination28.com',
  /** 編輯部社群（有就填，沒有留空字串；Organization.sameAs 只收非空值） */
  social: {
    youtube: '',
    instagram: '',
    threads: '',
    x: '',
    facebook: '',
  },
  /** 作品按讚計數 API（Google Apps Script Web App）。留空則按讚按鈕自動隱藏 */
  likesApiUrl: '',
  /** GA4 Measurement ID。留空則 production build 不載入 gtag */
  gaId: '',
} as const;

/**
 * 站內連結 helper：所有相對連結一律經過這裡加 base。
 *   href('/creators/')  →  '/creators/'            （base '/'）
 *   href('/creators/')  →  '/repo/creators/'       （base '/repo'）
 * 已經是絕對 URL（http/https/mailto）或 hash 的原樣回傳。
 */
export function href(path: string): string {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return BASE_PATH === '/' ? clean : `${BASE_PATH}${clean}`;
}

/** 絕對 URL（給 canonical / og / JSON-LD） */
export function absUrl(path: string): string {
  if (/^https?:/.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}

/**
 * Astro 圖片 src → 絕對 URL（JSON-LD image / thumbnailUrl、og:image 用）。
 * astro:assets 產生的 src 已含 base（/repo/_astro/x.jpg），只需補 origin；
 * public/ 相對路徑（/og-default.png）或已是絕對 URL 的則交給 absUrl。
 */
export function absAsset(src: string): string {
  if (/^https?:/.test(src)) return src;
  if (BASE_PATH !== '/' && src.startsWith(`${BASE_PATH}/`)) return `${SITE_ORIGIN}${src}`;
  return absUrl(src);
}

/* ── 路由 helper：所有頁面組 URL 一律用這些，避免手拼字串漂移 ── */
export const routes = {
  home: () => href('/'),
  creators: () => href('/creators/'),
  creator: (slug: string) => href(`/creator/${slug}/`),
  works: () => href('/works/'),
  work: (slug: string) => href(`/work/${slug}/`),
  posts: () => href('/posts/'),
  post: (urlSlug: string) => href(`/post/${urlSlug}/`),
  events: () => href('/events/'),
  event: (slug: string) => href(`/event/${slug}/`),
  tool: (slug: string) => href(`/tool/${slug}/`),
  genre: (slug: string) => href(`/genre/${slug}/`),
  about: () => href('/about/'),
  contact: () => href('/contact/'),
  privacy: () => href('/privacy/'),
  sitemap: () => href('/sitemap/'),
  rss: () => href('/rss.xml'),
} as const;

/** 絕對版（JSON-LD @id / url 用） */
export const absRoutes = {
  home: () => absUrl('/'),
  creators: () => absUrl('/creators/'),
  creator: (slug: string) => absUrl(`/creator/${slug}/`),
  creatorId: (slug: string) => absUrl(`/creator/${slug}/#person`),
  works: () => absUrl('/works/'),
  work: (slug: string) => absUrl(`/work/${slug}/`),
  posts: () => absUrl('/posts/'),
  post: (urlSlug: string) => absUrl(`/post/${urlSlug}/`),
  events: () => absUrl('/events/'),
  event: (slug: string) => absUrl(`/event/${slug}/`),
  tool: (slug: string) => absUrl(`/tool/${slug}/`),
  genre: (slug: string) => absUrl(`/genre/${slug}/`),
} as const;

export type NavItem = {
  label: string;
  labelEn: string;
  href: string;
  /** 一行說明（手機抽屜 / sitemap 用） */
  note?: string;
};

/** 主選單（桌機橫列 / 手機橫向捲動） */
export const PRIMARY_NAV: NavItem[] = [
  { label: '創作者', labelEn: 'CREATORS', href: '/creators/', note: '圖鑑總表：一頁列完所有收錄創作者' },
  { label: '作品', labelEn: 'WORKS', href: '/works/', note: '全部作品，依發表時間排列' },
  { label: '訪談與教學', labelEn: 'READ', href: '/posts/', note: '創作者訪談與 AI 影視教學' },
  { label: '活動', labelEn: 'EVENTS', href: '/events/', note: '比賽、工作坊、放映與講座' },
];

/** 手機版右上角抽屜選單 */
export type MobileNavItem = {
  label: string;
  labelEn: string;
  href: string;
  external?: boolean;
};

export const MOBILE_NAV: MobileNavItem[] = [
  { label: '創作者', labelEn: 'Creators', href: '/creators/', external: false },
  { label: '全部作品', labelEn: 'Works', href: '/works/', external: false },
  { label: '訪談與教學', labelEn: 'Read', href: '/posts/', external: false },
  { label: '活動', labelEn: 'Events', href: '/events/', external: false },
  { label: '關於圖鑑', labelEn: 'About', href: '/about/', external: false },
  { label: '聯絡／推薦收錄', labelEn: 'Contact', href: '/contact/', external: false },
  { label: 'Sitemap', labelEn: 'Sitemap', href: '/sitemap/', external: false },
  { label: '隱私權政策', labelEn: 'Privacy', href: '/privacy/', external: false },
];

/** Footer 第二欄：索引入口 */
export const FOOTER_INDEX = [
  { label: '創作者', href: '/creators/' },
  { label: '全部作品', href: '/works/' },
  { label: '訪談與教學', href: '/posts/' },
  { label: '活動', href: '/events/' },
];

/** Footer 第三欄：關於 */
export const FOOTER_ABOUT = [
  { label: '關於圖鑑・收錄準則', href: '/about/' },
  { label: '聯絡／推薦收錄', href: '/contact/' },
  { label: 'RSS 訂閱', href: '/rss.xml' },
  { label: 'Sitemap', href: '/sitemap/' },
  { label: '隱私權政策', href: '/privacy/' },
];
