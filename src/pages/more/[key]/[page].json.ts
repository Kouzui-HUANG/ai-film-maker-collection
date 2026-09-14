import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import type { Work } from '../../../data/queries';
import { fmtDuration } from '../../../data/queries';
import { getWorkAwardBadge } from '../../../data/awards';
import { genreLabel } from '../../../data/genres';
import { routes } from '../../../data/site';
import { getMoreLists, chunkCount, chunkSlice } from '../../../data/listings';

/**
 * /works/ 「捲到底再載入」用的資料端點。
 * 產出檔案：/more/works/1.json、/more/works/2.json …（build 時全部靜態產生；
 * 作品數 ≤ MORE_INITIAL 時不會產生任何檔案）。
 *
 * 縮圖用 getImage() 走與 WorkCard 的 <Image> 完全相同的轉檔參數，
 * 才能拿到同一批 /_astro/*.webp 檔名，前端 clone 卡片後直接套 src/srcset。
 * getImage() 回傳的 src 已含 base（與 <Image> 一致）。
 */

const IMAGE_OPTS = {
  width: 640,
  height: 360,
  widths: [480, 640, 960, 1280],
  sizes: '(max-width: 640px) 92vw, (max-width: 1240px) 45vw, 380px',
};

async function toCard(work: Work) {
  const { title, slug, year, genre, durationSec, thumb, thumbAlt, awards } = work.data;
  const img = await getImage({ src: thumb, ...IMAGE_OPTS });
  const meta = [String(year), genreLabel(genre), fmtDuration(durationSec)].filter(Boolean).join('・');
  const awardBadge = getWorkAwardBadge(awards);

  return {
    href: routes.work(slug),
    title,
    creators: work.creators.map((c) => ({ name: c.name, href: routes.creator(c.slug) })),
    meta,
    awardLabel: awardBadge?.label ?? '',
    awardStatus: awardBadge?.status ?? '',
    awardAriaLabel: awardBadge?.ariaLabel ?? '',
    alt: thumbAlt,
    src: img.src,
    srcset: img.srcSet?.attribute ?? '',
  };
}

export async function getStaticPaths() {
  const lists = await getMoreLists();
  const paths: Array<{ params: { key: string; page: string } }> = [];

  for (const [key, works] of lists) {
    const pages = chunkCount(works.length);
    for (let page = 1; page <= pages; page += 1) {
      paths.push({ params: { key, page: String(page) } });
    }
  }

  return paths;
}

export const GET: APIRoute = async ({ params }) => {
  const lists = await getMoreLists();
  const works = lists.get(String(params.key)) ?? [];
  const slice = chunkSlice(works, Number(params.page));
  const items = await Promise.all(slice.map(toCard));

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
