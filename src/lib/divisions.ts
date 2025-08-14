// Canonical division list & type guard

import type { DivisionId } from '@/lib/types';

export const DIVISIONS: Record<DivisionId, string> = {
  '4v4-lowb': '4v4 Low B',
  '4v4': '4v4',
  '4v4-highba': '4v4 High B/A',
  '4v4-women': '4v4 Women',
  '5v5': '5v5',
};

export function isDivisionId(v: string): v is DivisionId {
  return v in DIVISIONS;
}

export const DEFAULT_ROSTER_LIMIT = 8;
