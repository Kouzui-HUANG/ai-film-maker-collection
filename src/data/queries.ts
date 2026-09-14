/**
 * 關聯查詢層（取代 JP¥ ONLINE 的 listings.ts）。
 *
 * 所有頁面一律透過 getSiteData() 取資料，不要各自 getCollection：
 *   - draft 過濾、排序、work → creator 反查、post → creator 反查只做一次（memoized）
 *   - creator 頁的作品清單在這裡由 works 反查（單向關聯，§2-2）
 *   - events 的 upcoming / ongoing / past 在這裡算（時效性引擎）
 *
 * 型別命名：
 *   CreatorRef = 創作者摘要（給 Work / Post 掛，沒有 works 欄位，避免循環）
 *   Creator    = CreatorRef + entry + works + posts（創作者頁用）
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { computeTiming, sortUpcoming, sortPast, todayTaipei, type EventTiming } from './events';
import { getToolWorkCounts } from './tools';
import { getGenreWorkCounts } from './genres';

export type CreatorEntry = CollectionEntry<'creators'>;
export type WorkEntry = CollectionEntry<'works'>;
export type PostEntry = CollectionEntry<'posts'>;
export type EventEntry = CollectionEntry<'events'>;

export type CreatorRef = {
  id: string;
  no: number;
  name: string;
  nameEn?: string;
  slug: string;
  tagline: string;
  portrait: ImageMetadata;
  portraitAlt: string;
  region?: string;
  role?: string[];
  tools: string[];
  genres: string[];
  categories: string[];
  listedAt: string;
};

export type Work = {
  id: string;
  entry: WorkEntry;
  data: WorkEntry['data'];
  /** 依 frontmatter 順序解析後的創作者（第一位視為主創作者） */
  creators: CreatorRef[];
  /** 排序鍵：releasedAt ?? `${year}-01-01` */
  sortDate: string;
};

export type Post = {
  id: string;
  entry: PostEntry;
  data: PostEntry['data'];
  creators: CreatorRef[];
};

export type Creator = CreatorRef & {
  entry: CreatorEntry;
  data: CreatorEntry['data'];
  /** 反查 works，依 sortDate 倒序 */
  works: Work[];
  /** 反查 posts（訪談對象 / 教學提到），依 date 倒序 */
  posts: Post[];
  workCount: number;
  /** 代表作：最新一部（資料格網「代表作」欄位用） */
  latestWork: Work | null;
};

export type SiteEvent = {
  id: string;
  entry: EventEntry;
  data: EventEntry['data'];
  timing: EventTiming;
};

export type SiteData = {
  /** build 當天（台北） "YYYY-MM-DD" */
  today: string;
  /** 依編號正序 */
  creators: Creator[];
  /** 依 sortDate 倒序（最新在前） */
  works: Work[];
  /** 依 date 倒序 */
  posts: Post[];
  /** 全部活動（含 past） */
  events: SiteEvent[];
  /** upcoming + ongoing，依 startDate 正序 */
  upcomingEvents: SiteEvent[];
  /** past，依 startDate 倒序 */
  pastEvents: SiteEvent[];
  /** 首頁焦點創作者（spotlight: true；多位時取編號最小並警告；沒有則取最新收錄） */
  spotlight: Creator | null;
  /** 工具 slug → 作品數 */
  toolCounts: Map<string, number>;
  /** 類型 slug → 作品數 */
  genreCounts: Map<string, number>;
  /** 快速查表 */
  creatorById: Map<string, Creator>;
  workById: Map<string, Work>;
  postByUrlSlug: Map<string, Post>;
  eventById: Map<string, SiteEvent>;
};

function toRef(e: CreatorEntry): CreatorRef {
  const d = e.data;
  return {
    id: e.id,
    no: d.no,
    name: d.name,
    nameEn: d.nameEn,
    slug: d.slug,
    tagline: d.tagline,
    portrait: d.portrait,
    portraitAlt: d.portraitAlt,
    region: d.region,
    role: d.role,
    tools: d.tools,
    genres: d.genres,
    categories: d.categories,
    listedAt: d.listedAt,
  };
}

async function build(): Promise<SiteData> {
  const today = todayTaipei();

  const [creatorEntries, workEntries, postEntries, eventEntries] = await Promise.all([
    getCollection('creators', ({ data }) => !data.draft),
    getCollection('works', ({ data }) => !data.draft),
    getCollection('posts', ({ data }) => !data.draft),
    getCollection('events', ({ data }) => !data.draft),
  ]);

  /* ── creators：id 必須等於 slug（資料夾名 = slug），否則 reference 會對不上 ── */
  const refById = new Map<string, CreatorRef>();
  for (const e of creatorEntries) {
    if (e.id !== e.data.slug) {
      throw new Error(`[creators] 資料夾名「${e.id}」與 frontmatter slug「${e.data.slug}」不一致`);
    }
    refById.set(e.id, toRef(e));
  }

  const resolveRefs = (refs: { id: string }[] | undefined, from: string): CreatorRef[] =>
    (refs ?? []).map((r) => {
      const c = refById.get(r.id);
      if (!c) throw new Error(`[${from}] 找不到創作者「${r.id}」（或該創作者為 draft）`);
      return c;
    });

  /* ── works ── */
  const works: Work[] = workEntries
    .map((e) => ({
      id: e.id,
      entry: e,
      data: e.data,
      creators: resolveRefs(e.data.creators, `works/${e.id}`),
      sortDate: e.data.releasedAt ?? `${e.data.year}-01-01`,
    }))
    .sort((a, b) => b.sortDate.localeCompare(a.sortDate) || a.data.title.localeCompare(b.data.title, 'zh-Hant'));

  /* ── posts ── */
  const posts: Post[] = postEntries
    .map((e) => ({
      id: e.id,
      entry: e,
      data: e.data,
      creators: resolveRefs(e.data.creators, `posts/${e.id}`),
    }))
    .sort((a, b) => b.data.date.localeCompare(a.data.date));

  /* ── creators（反查 works / posts） ── */
  const creators: Creator[] = creatorEntries
    .map((e) => {
      const ref = refById.get(e.id)!;
      const myWorks = works.filter((w) => w.creators.some((c) => c.id === e.id));
      const myPosts = posts.filter((p) => p.creators.some((c) => c.id === e.id));
      return {
        ...ref,
        entry: e,
        data: e.data,
        works: myWorks,
        posts: myPosts,
        workCount: myWorks.length,
        latestWork: myWorks[0] ?? null,
      };
    })
    .sort((a, b) => a.no - b.no);

  /* ── events（時效性引擎） ── */
  const events: SiteEvent[] = eventEntries.map((e) => ({
    id: e.id,
    entry: e,
    data: e.data,
    timing: computeTiming(e.data, today),
  }));
  const upcomingEvents = sortUpcoming(events.filter((e) => e.timing.status !== 'past'));
  const pastEvents = sortPast(events.filter((e) => e.timing.status === 'past'));

  /* ── spotlight ── */
  const spotlights = creators.filter((c) => c.data.spotlight);
  if (spotlights.length > 1) {
    console.warn(
      `[queries] spotlight: true 有 ${spotlights.length} 位（${spotlights.map((c) => c.slug).join(', ')}），首頁只取編號最小的一位`,
    );
  }
  const latestListed = [...creators].sort((a, b) => b.listedAt.localeCompare(a.listedAt))[0] ?? null;
  const spotlight = spotlights[0] ?? latestListed;

  return {
    today,
    creators,
    works,
    posts,
    events,
    upcomingEvents,
    pastEvents,
    spotlight,
    toolCounts: getToolWorkCounts(works.map((w) => w.data)),
    genreCounts: getGenreWorkCounts(works.map((w) => w.data)),
    creatorById: new Map(creators.map((c) => [c.id, c])),
    workById: new Map(works.map((w) => [w.id, w])),
    postByUrlSlug: new Map(posts.map((p) => [p.data.urlSlug, p])),
    eventById: new Map(events.map((e) => [e.id, e])),
  };
}

let cache: Promise<SiteData> | null = null;

/** 整站資料（memoized，一次 build 只算一次） */
export function getSiteData(): Promise<SiteData> {
  if (!cache) cache = build();
  return cache;
}

/* ── 便利查詢（都是純函式，吃 SiteData） ─────────────────────── */

/** 依收錄日倒序的創作者（首頁「最新收錄」） */
export function creatorsByListedAt(d: SiteData): Creator[] {
  return [...d.creators].sort((a, b) => b.listedAt.localeCompare(a.listedAt) || b.no - a.no);
}

/** 依作品數倒序 */
export function creatorsByWorkCount(d: SiteData): Creator[] {
  return [...d.creators].sort((a, b) => b.workCount - a.workCount || a.no - b.no);
}

export function worksByTool(d: SiteData, tool: string): Work[] {
  return d.works.filter((w) => w.data.tools.includes(tool));
}

export function worksByGenre(d: SiteData, genre: string): Work[] {
  return d.works.filter((w) => w.data.genre === genre);
}

/** 該工具的創作者：creator.tools 有列，或其任一作品用到 */
export function creatorsByTool(d: SiteData, tool: string): Creator[] {
  return d.creators.filter(
    (c) => c.tools.includes(tool) || c.works.some((w) => w.data.tools.includes(tool)),
  );
}

/** 該類型的創作者：creator.genres 有列，或其任一作品屬於該類型 */
export function creatorsByGenre(d: SiteData, genre: string): Creator[] {
  return d.creators.filter(
    (c) => c.genres.includes(genre) || c.works.some((w) => w.data.genre === genre),
  );
}

export function postsByTool(d: SiteData, tool: string): Post[] {
  return d.posts.filter((p) => (p.data.tools ?? []).includes(tool));
}

/** 同創作者其他作品（排除自己），最多 limit 部 */
export function siblingWorks(d: SiteData, work: Work, limit = 6): Work[] {
  const ids = new Set(work.creators.map((c) => c.id));
  return d.works.filter((w) => w.id !== work.id && w.creators.some((c) => ids.has(c.id))).slice(0, limit);
}

/** 同工具其他作品（排除自己與同創作者），依共用工具數排序 */
export function relatedWorksByTool(d: SiteData, work: Work, limit = 6): Work[] {
  const mine = new Set(work.data.tools);
  const ownerIds = new Set(work.creators.map((c) => c.id));
  return d.works
    .filter((w) => w.id !== work.id && !w.creators.some((c) => ownerIds.has(c.id)))
    .map((w) => ({ w, shared: w.data.tools.filter((t) => mine.has(t)).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || b.w.sortDate.localeCompare(a.w.sortDate))
    .slice(0, limit)
    .map((x) => x.w);
}

/** 秒數 → ISO 8601 duration（VideoObject.duration） */
export function isoDuration(sec?: number): string | undefined {
  if (!sec || sec <= 0) return undefined;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s || (!h && !m) ? `${s}S` : ''}`;
}

/** 秒數 → 顯示用 "3:24" / "1:02:05" */
export function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/* ── 影片 URL 解析（YouTube / Vimeo → embed / id） ──────────── */

export type VideoInfo =
  | { provider: 'youtube'; id: string; embedUrl: string; watchUrl: string }
  | { provider: 'vimeo'; id: string; embedUrl: string; watchUrl: string }
  | { provider: 'unknown'; id: null; embedUrl: null; watchUrl: string };

export function parseVideoUrl(url: string): VideoInfo {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { provider: 'unknown', id: null, embedUrl: null, watchUrl: url };
  }
  const host = u.hostname.replace(/^www\./, '');

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] || null;
    else if (u.pathname.startsWith('/watch')) id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/);
      if (m) id = m[1];
    }
    if (id) {
      return {
        provider: 'youtube',
        id,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
        watchUrl: `https://www.youtube.com/watch?v=${id}`,
      };
    }
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // 依路徑結構解析（不會把 /user12345678/ 當成影片 id）；未列出影片的 hash（/<id>/<hash> 或 ?h=）要保留
    const m = u.pathname.match(
      /^\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/|showcase\/\d+\/video\/)?(\d+)(?:\/([0-9a-f]+))?\/?$/i,
    );
    if (m) {
      const id = m[1];
      const hash = m[2] ?? u.searchParams.get('h') ?? '';
      return {
        provider: 'vimeo',
        id,
        embedUrl: `https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&` : ''}autoplay=1`,
        watchUrl: `https://vimeo.com/${id}${hash ? `/${hash}` : ''}`,
      };
    }
  }

  return { provider: 'unknown', id: null, embedUrl: null, watchUrl: url };
}
