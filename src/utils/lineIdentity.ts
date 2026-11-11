import type { LineBinding, Member } from '../types';

export type BindingMap = Record<string, LineBinding>;

/** SHA-256(`${code}:${userId}`) 的十六進位字串。每個空間不同，從雜湊無法反推 LINE userId。 */
export async function computeLineKey(code: string, userId: string): Promise<string> {
  const data = new TextEncoder().encode(`${code}:${userId}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function findMyBinding(bindings: BindingMap, myLineKey: string | null) {
  if (!myLineKey) return null;
  for (const [memberId, binding] of Object.entries(bindings)) {
    if (binding.lineKey === myLineKey) return { memberId, binding };
  }
  return null;
}

export interface LineResolutionInput {
  roster: Member[];
  bindings: BindingMap;
  myLineKey: string | null;
  currentMemberId: string | undefined;
  /** 本次工作階段在 LINE 內手動切換過身分：不再自動設回綁定的成員。 */
  overridden: boolean;
}

export interface LineResolution {
  setMemberId: string | null;
  /** 綁定的成員不在名單（被整份覆寫弄丟）時，用原 id 補回。 */
  restore: Member | null;
  notice: string | null;
}

const NONE: LineResolution = { setMemberId: null, restore: null, notice: null };

/** 依 LINE 綁定決定「我是誰」。只處理已綁定的情況；沒有綁定時交給身分選擇畫面。 */
export function planLineResolution(input: LineResolutionInput): LineResolution {
  const { roster, bindings, myLineKey, currentMemberId, overridden } = input;
  const mine = findMyBinding(bindings, myLineKey);
  if (!mine || overridden) return NONE;
  if (currentMemberId === mine.memberId && roster.some((m) => m.id === mine.memberId)) return NONE;

  const existing = roster.find((m) => m.id === mine.memberId);
  if (existing) {
    return { setMemberId: existing.id, restore: null, notice: `已用 LINE 自動辨識：${existing.name}` };
  }
  // 成員不在名單：以原 id 補回。名字若已被別的成員使用，加上標記避免同名。
  const base = mine.binding.memberName.trim() || '成員';
  const name = roster.some((m) => m.name === base) ? `${base}（LINE）` : base;
  return { setMemberId: mine.memberId, restore: { id: mine.memberId, name }, notice: `已用 LINE 自動辨識：${name}` };
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '');
}

/** 名稱與 LINE 顯示名稱相同、而且還沒被別人綁定的成員，作為「我是 X」的建議。 */
export function suggestMemberForLineName(roster: Member[], bindings: BindingMap, displayName: string): Member | undefined {
  const target = normalizeName(displayName);
  if (!target) return undefined;
  return roster.find((m) => normalizeName(m.name) === target && !bindings[m.id]);
}
