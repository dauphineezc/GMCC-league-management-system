export const DEFAULT_ROSTER_LIMIT = 8;

export const DIVISIONS = [
  { id: "4v4b", name: "4v4 low B" },
  { id: "4v4", name: "4v4" },
  { id: "4v4a", name: "4v4 high B/A" },
  { id: "4v4w", name: "4v4 Women" },
  { id: "5v5",  name: "5v5"  },
] as const;

export type DivisionId = (typeof DIVISIONS)[number]["id"];

const ALIASES: Record<string, DivisionId> = {
  "4v4": "4v4",
  "4V4": "4v4",
  "4v4B": "4v4b",
  "4V4B": "4v4b",
  "4V4b": "4v4b",
  "4v4 Women": "4v4w",
  "4V4 Women": "4v4w",
  "5v5": "5v5",
  "5V5": "5v5",
};

export function normalizeDivision(input: string): DivisionId | null {
  const v = (input || "").trim();
  if (DIVISIONS.some(d => d.id === v)) return v as DivisionId;
  return ALIASES[v] ?? null;
}

export function isDivisionId(input: string): input is DivisionId {
  return DIVISIONS.some(d => d.id === input);
}