import type { Member } from '../types';
import type { RecentSpace } from '../store/lastSpaceStore';
import { useIdentityStore } from '../store/identityStore';
import { useRecentSpacesStore } from '../store/lastSpaceStore';
import { useGroupStore } from '../store/groupStore';

export interface LegacyMigrationInput {
  code: string;
  byCode: Record<string, string>;
  legacyName: string | null;
  recentSpaces: RecentSpace[];
  roster: Member[];
}

export interface LegacyMigrationPlan {
  /** 要記到 byCode[code] 的成員；undefined 表示不改動。 */
  memberId: string | undefined;
  /** 全域 legacyName 只屬於升級後第一個連上的空間，用過一次就清掉。 */
  clearGlobalLegacy: boolean;
  clearRecentLegacy: boolean;
}

/**
 * 舊版以「名字字串」當身分；新版改成每個空間記 memberId。
 * 在空間名單載入後，用舊名字在「這個空間」的名單找成員；找不到就清掉舊名字，讓使用者重新選。
 */
export function planLegacyMigration(input: LegacyMigrationInput): LegacyMigrationPlan {
  const { code, byCode, legacyName, recentSpaces, roster } = input;
  const recentLegacy = recentSpaces.find((s) => s.code === code)?.legacyName;
  const plan: LegacyMigrationPlan = {
    memberId: undefined,
    clearGlobalLegacy: legacyName !== null,
    clearRecentLegacy: recentLegacy !== undefined,
  };
  if (byCode[code]) return plan;
  // 這個空間自己記下的名字（綁定 code）比全域名字可信：舊版按「重新輸入同步碼」時不會清身分，
  // 全域名字可能屬於別的空間。
  const name = (recentLegacy ?? legacyName)?.trim();
  if (!name) return plan;
  plan.memberId = roster.find((m) => m.name === name)?.id;
  return plan;
}

/** 連上空間、名單已載入後呼叫（App 的 onReady），在畫面決定要不要顯示身分選擇之前完成遷移。 */
export function applyLegacyIdentityMigration(code: string) {
  const identity = useIdentityStore.getState();
  const recent = useRecentSpacesStore.getState();
  const plan = planLegacyMigration({
    code,
    byCode: identity.byCode,
    legacyName: identity.legacyName,
    recentSpaces: recent.recentSpaces,
    roster: useGroupStore.getState().members,
  });
  if (plan.memberId) identity.setMember(code, plan.memberId);
  if (plan.clearGlobalLegacy) identity.clearLegacyName();
  if (plan.clearRecentLegacy) recent.clearRecentLegacyName(code);
}
