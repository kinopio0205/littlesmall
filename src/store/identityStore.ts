import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 寫入 localStorage 的部分。 */
export interface IdentityPersisted {
  /** 每個同步空間各自記住「我是哪個成員」：syncCode → memberId。 */
  byCode: Record<string, string>;
  /**
   * 舊版（v0）只存一個全域名字字串。升級後先留著，等第一次連上空間、
   * 名單載入後再換成該空間的 memberId（見 utils/identityMigration.ts）。
   */
  legacyName: string | null;
  /** 選了「此空間不再詢問」LINE 綁定的空間。 */
  noLineAskByCode?: Record<string, true>;
}

interface IdentityState extends IdentityPersisted {
  setMember: (code: string, memberId: string) => void;
  clearMember: (code: string) => void;
  clearLegacyName: () => void;
  setNoLineAsk: (code: string) => void;
}

export function migrateIdentity(persisted: unknown, version: number): IdentityPersisted {
  const p = (persisted ?? {}) as Record<string, unknown>;
  if (version < 1) {
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    return { byCode: {}, legacyName: name || null };
  }
  return {
    byCode: (p.byCode as Record<string, string> | undefined) ?? {},
    legacyName: typeof p.legacyName === 'string' ? p.legacyName : null,
    noLineAskByCode: (p.noLineAskByCode as Record<string, true> | undefined) ?? {},
  };
}

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set) => ({
      byCode: {},
      legacyName: null,
      setMember: (code, memberId) => set((s) => ({ byCode: { ...s.byCode, [code]: memberId } })),
      clearMember: (code) =>
        set((s) => {
          const byCode = { ...s.byCode };
          delete byCode[code];
          return { byCode };
        }),
      clearLegacyName: () => set({ legacyName: null }),
      noLineAskByCode: {},
      setNoLineAsk: (code) => set((s) => ({ noLineAskByCode: { ...s.noLineAskByCode, [code]: true } })),
    }),
    {
      name: 'ledger-identity',
      version: 1,
      migrate: migrateIdentity,
      partialize: (s): IdentityPersisted => ({
        byCode: s.byCode,
        legacyName: s.legacyName,
        noLineAskByCode: s.noLineAskByCode,
      }),
    },
  ),
);

// 多個分頁同時開著時，persist 每次都整份寫回；先同步其他分頁的變更，避免用舊的 byCode 蓋掉別的空間的身分。
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'ledger-identity') void useIdentityStore.persist.rehydrate();
  });
}
