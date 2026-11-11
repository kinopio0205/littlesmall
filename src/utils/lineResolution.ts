import { useBindingStore } from '../store/bindingStore';
import { useGroupStore } from '../store/groupStore';
import { useIdentityStore } from '../store/identityStore';
import { planLineResolution } from './lineIdentity';

/**
 * 名單與 LINE 綁定清單都載入後，依綁定自動決定身分。兩者任一更新都會呼叫，條件不齊就不做事。
 * 只處理「已綁定」；沒有綁定時由身分選擇畫面詢問。
 */
export function applyLineResolution(code: string) {
  const binding = useBindingStore.getState();
  if (!binding.ready || binding.code !== code || binding.rosterReadyCode !== code) return;

  const identity = useIdentityStore.getState();
  const group = useGroupStore.getState();
  const plan = planLineResolution({
    roster: group.members,
    bindings: binding.bindings,
    myLineKey: binding.myLineKey,
    currentMemberId: identity.byCode[code],
    overridden: !!binding.overriddenCodes[code],
  });
  if (plan.restore) group.ensureRosterMember(plan.restore);
  if (plan.setMemberId) identity.setMember(code, plan.setMemberId);
  if (plan.notice) binding.setNotice(plan.notice);
}
