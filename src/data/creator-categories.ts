/**
 * 創作者類型分類受控詞彙。
 *
 * 這組分類描述創作者主要投入的內容或技術方向，與作品的 `genre` 分開維護。
 */

export interface CreatorCategoryDef {
  slug: string;
  label: string;
}

export const CREATOR_CATEGORIES: CreatorCategoryDef[] = [
  { slug: 'social-video', label: '社群短片' },
  { slug: 'marketing-ad', label: '行銷廣告' },
  { slug: 'serial-short-drama', label: '連續短劇' },
  { slug: 'film', label: '影視電影' },
  { slug: 'music-mv', label: '音樂MV' },
  { slug: 'animation-comics', label: '動畫漫畫' },
  { slug: 'lecture-teaching', label: '講座教學' },
  { slug: 'model-training', label: '模型訓練' },
  { slug: 'local-workflow', label: '地端工作流' },
];

export const CREATOR_CATEGORY_BY_SLUG: Record<string, CreatorCategoryDef> = Object.fromEntries(
  CREATOR_CATEGORIES.map((category) => [category.slug, category]),
);

export function creatorCategoryLabel(slug: string): string {
  return CREATOR_CATEGORY_BY_SLUG[slug]?.label ?? slug;
}
