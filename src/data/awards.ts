/** 作品獎項的受控狀態。只有 winner 會進 /works/ 頁首的得獎專區。 */
export type WorkAwardStatus = 'winner' | 'finalist' | 'selection';

export type WorkAward = {
  year: number;
  title: string;
  result: string;
  status: WorkAwardStatus;
};

const STATUS_META: Record<WorkAwardStatus, { label: string; ariaLabel: string }> = {
  winner: { label: 'WINNER', ariaLabel: '得獎作品' },
  finalist: { label: 'FINALIST', ariaLabel: '入圍或短名單作品' },
  selection: { label: 'SELECTED', ariaLabel: '官方入選作品' },
};

const STATUS_PRIORITY: WorkAwardStatus[] = ['winner', 'finalist', 'selection'];

export function formatWorkAward(award: WorkAward): string {
  return `${award.year} ${award.title}・${award.result}`;
}

/** 多筆紀錄時，以得獎 > 入圍 > 官方入選決定列表卡片角標。 */
export function getWorkAwardBadge(awards?: readonly WorkAward[]) {
  if (!awards?.length) return null;
  for (const status of STATUS_PRIORITY) {
    if (awards.some((award) => award.status === status)) {
      return { status, ...STATUS_META[status] };
    }
  }
  return null;
}

/** 頁首得獎卡使用第一筆明確得獎紀錄；frontmatter 順序即編輯優先序。 */
export function getWinningAward(awards?: readonly WorkAward[]): WorkAward | null {
  return awards?.find((award) => award.status === 'winner') ?? null;
}
