import { useGroupStore } from '../store/groupStore';
import { useIdentityStore } from '../store/identityStore';
import { useSyncStore } from '../store/syncStore';
import type { Member } from '../types';

/** 目前空間中「我」的成員；尚未選擇，或該成員已不在名單時為 undefined。 */
export function useMyMember(): Member | undefined {
  const code = useSyncStore((s) => s.code);
  const memberId = useIdentityStore((s) => (code ? s.byCode[code] : undefined));
  return useGroupStore((s) => (memberId ? s.members.find((m) => m.id === memberId) : undefined));
}
