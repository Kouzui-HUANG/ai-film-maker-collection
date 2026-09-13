/**
 * /rss.xml — 全站 RSS
 *
 * items = posts（訪談／教學）+ works（作品）混排，依日期倒序，cap 30。
 *   - post：description = excerpt、categories = 訪談／教學、enclosure = cover、dc:creator = author
 *   - work：description = synopsis、categories = 類型 label、enclosure = thumb、dc:creator = 創作者名
 * link 一律 absRoutes；atom:link self 用 absUrl('/rss.xml')。
 */
import rss from '@astrojs/rss';
import { SITE, absUrl, absRoutes } from '../data/site.ts';
import { getSiteData } from '../data/queries.ts';
import { genreLabel, POST_TYPE_LABEL } from '../data/genres.ts';

const ITEM_CAP = 30;

const FORMAT_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
};

/** Astro 圖片 src → 絕對 URL（build 時 src 已含 base，處理方式同 BaseLayout 的 ogImage） */
function assetAbsUrl(src) {
  if (/^https?:/.test(src)) return src;
  if (SITE.base !== '/' && src.startsWith(SITE.base)) return `${SITE.origin}${src}`;
  return absUrl(src);
}

/** "YYYY-MM-DD" → 台北時區當日零時 */
function taipeiDate(ymd) {
  return new Date(`${ymd}T00:00:00+08:00`);
}

function cdata(text) {
  return `<![CDATA[${String(text).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

export async function GET() {
  const d = await getSiteData();

  const postItems = d.posts.map((p) => ({
    sortDate: p.data.date,
    item: {
      title: p.data.title,
      description: p.data.excerpt,
      pubDate: taipeiDate(p.data.date),
      link: absRoutes.post(p.data.urlSlug),
      categories: [POST_TYPE_LABEL[p.data.type]?.label ?? p.data.type],
      enclosure: {
        url: assetAbsUrl(p.data.cover.src),
        length: 0,
        type: FORMAT_TO_MIME[p.data.cover.format] || 'image/jpeg',
      },
      customData: `<dc:creator>${cdata(p.data.author)}</dc:creator>`,
    },
  }));

  const workItems = d.works.map((w) => ({
    sortDate: w.sortDate,
    item: {
      title: w.data.title,
      description: w.data.synopsis,
      pubDate: taipeiDate(w.sortDate),
      link: absRoutes.work(w.data.slug),
      categories: [genreLabel(w.data.genre)],
      enclosure: {
        url: assetAbsUrl(w.data.thumb.src),
        length: 0,
        type: FORMAT_TO_MIME[w.data.thumb.format] || 'image/jpeg',
      },
      customData: `<dc:creator>${cdata(w.creators.map((c) => c.name).join('、'))}</dc:creator>`,
    },
  }));

  const merged = [...postItems, ...workItems]
    .sort((a, b) => b.sortDate.localeCompare(a.sortDate) || a.item.title.localeCompare(b.item.title, 'zh-Hant'))
    .slice(0, ITEM_CAP);

  const items = merged.map((x) => x.item);
  const lastBuildDate = merged[0] ? taipeiDate(merged[0].sortDate) : new Date();

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: SITE.url,
    items,
    xmlns: {
      dc: 'http://purl.org/dc/elements/1.1/',
      atom: 'http://www.w3.org/2005/Atom',
    },
    customData:
      `<language>zh-tw</language>` +
      `<lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>` +
      `<atom:link href="${absUrl('/rss.xml')}" rel="self" type="application/rss+xml" />`,
  });
}
