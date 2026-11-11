import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentSpace {
  code: string;
  /** 只用來在「返回上一個空間」按鈕上顯示；身分以 identityStore.byCode 為準。 */
  memberName?: string;
  /** 舊版 lastSpace 留下的名字，第一次回到這個空間時換成 memberId 後清掉。 */
  legacyName?: string;
  lastUsedAt: number;
}

interface RecentSpacesPersisted {
  recentSpaces: RecentSpace[];
}

interface RecentSpacesState extends RecentSpacesPersisted {
  rememberSpace: (code: string, memberName?: string) => void;
  clearRecentLegacyName: (code: string) => void;
}

const MAX_RECENT = 5;

export function upsertRecentSpace(list: RecentSpace[], entry: RecentSpace): RecentSpace[] {
  return [entry, ...list.filter((s) => s.code !== entry.code)].slice(0, MAX_RECENT);
}

export function migrateRecentSpaces(persisted: unknown, version: number): RecentSpacesPersisted {
  const p = (persisted ?? {}) as Record<string, unknown>;
  if (version < 1) {
    const last = p.lastSpace as { code?: unknown; identity?: unknown } | null | undefined;
    if (!last || typeof last.code !== 'string') return { recentSpaces: [] };
    const name = typeof last.identity === 'string' && last.identity.trim() ? last.identity.trim() : undefined;
    const entry: RecentSpace = { code: last.code, lastUsedAt: 0 };
    if (name) {
      entry.memberName = name;
      entry.legacyName = name;
    }
    return { recentSpaces: [entry] };
  }
  return { recentSpaces: Array.isArray(p.recentSpaces) ? (p.recentSpaces as RecentSpace[]) : [] };
}

// 沿用舊的 localStorage key（ledger-last-space），以便從 v0 的 lastSpace 遷移。
export const useRecentSpacesStore = create<RecentSpacesState>()(
  persist(
    (set) => ({
      recentSpaces: [],
      rememberSpace: (code, memberName) =>
        set((s) => {
          const previous = s.recentSpaces.find((r) => r.code === code);
          const entry: RecentSpace = { code, lastUsedAt: Date.now() };
          const name = memberName ?? previous?.memberName;
          if (name) entry.memberName = name;
          if (previous?.legacyName) entry.legacyName = previous.legacyName;
          return { recentSpaces: upsertRecentSpace(s.recentSpaces, entry) };
        }),
      clearRecentLegacyName: (code) =>
        set((s) => ({
          recentSpaces: s.recentSpaces.map((r) => {
            if (r.code !== code || r.legacyName === undefined) return r;
            const next = { ...r };
            delete next.legacyName;
            return next;
          }),
        })),
    }),
    {
      name: 'ledger-last-space',
      version: 1,
      migrate: migrateRecentSpaces,
      partialize: (s): RecentSpacesPersisted => ({ recentSpaces: s.recentSpaces }),
    },
  ),
);

// 同 identityStore：其他分頁寫入時重新載入，避免整份寫回時蓋掉其他分頁記下的空間。
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'ledger-last-space') void useRecentSpacesStore.persist.rehydrate();
  });
}
