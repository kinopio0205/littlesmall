import {
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore';
import { v4 as uuid } from 'uuid';
import { db } from '../firebase';
import { useGroupStore } from '../store/groupStore';
import type { Group, GroupExpense, Member, Settlement } from '../types';

interface LedgerDoc {
  members: Member[];
  groups: Group[];
  expenses: GroupExpense[];
  settlements: Settlement[];
}

interface LegacyGroup {
  id: string;
  name: string;
  icon: string;
  members?: Member[];
  createdAt: string;
}

function toLedgerDoc(state: LedgerDoc): LedgerDoc {
  return {
    members: state.members,
    groups: state.groups,
    expenses: state.expenses,
    settlements: state.settlements,
  };
}

/**
 * Older ledgers stored each group's members inline with per-group ids. This
 * lifts them into a single space-level roster (deduped by name) and rewrites
 * every expense/settlement memberId to point at the new roster ids, so
 * existing synced data keeps working after the roster migration.
 */
function migrateLedgerDoc(raw: DocumentData): { doc: LedgerDoc; migrated: boolean } {
  const rawGroups: LegacyGroup[] = raw?.groups ?? [];
  const hasLegacyShape = rawGroups.some((g) => Array.isArray(g.members));

  if (!hasLegacyShape) {
    return {
      doc: {
        members: raw?.members ?? [],
        groups: raw?.groups ?? [],
        expenses: raw?.expenses ?? [],
        settlements: raw?.settlements ?? [],
      },
      migrated: false,
    };
  }

  const roster: Member[] = [];
  const rosterIdByName = new Map<string, string>();
  const remap = new Map<string, string>(); // `${groupId}:${oldMemberId}` -> new roster id

  function rosterIdFor(name: string): string {
    const existing = rosterIdByName.get(name);
    if (existing) return existing;
    const id = uuid();
    rosterIdByName.set(name, id);
    roster.push({ id, name });
    return id;
  }

  const groups: Group[] = rawGroups.map((g) => {
    const legacyMembers = g.members ?? [];
    const memberIds = legacyMembers.map((m) => {
      const newId = rosterIdFor(m.name);
      remap.set(`${g.id}:${m.id}`, newId);
      return newId;
    });
    return { id: g.id, name: g.name, icon: g.icon, memberIds, createdAt: g.createdAt };
  });

  function remapId(groupId: string, oldId: string): string {
    return remap.get(`${groupId}:${oldId}`) ?? oldId;
  }

  const expenses: GroupExpense[] = (raw?.expenses ?? []).map((e: GroupExpense) => ({
    ...e,
    payerId: remapId(e.groupId, e.payerId),
    splits: e.splits.map((s) => ({ ...s, memberId: remapId(e.groupId, s.memberId) })),
  }));

  const settlements: Settlement[] = (raw?.settlements ?? []).map((s: Settlement) => ({
    ...s,
    fromMemberId: remapId(s.groupId, s.fromMemberId),
    toMemberId: remapId(s.groupId, s.toMemberId),
  }));

  return { doc: { members: roster, groups, expenses, settlements }, migrated: true };
}

const EMPTY_LEDGER: LedgerDoc = { members: [], groups: [], expenses: [], settlements: [] };

/**
 * 只在文件仍不存在時建立空帳本。固定寫入空帳本而不是讀當下的 store：
 * transaction 等待期間使用者可能已切到別的空間，store 裡會是另一個空間的資料。
 */
export async function createLedgerIfMissing(ref: DocumentReference) {
  await runTransaction(db, async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists()) {
      tx.set(ref, EMPTY_LEDGER);
    }
  });
}

let unsubscribeSnapshot: (() => void) | null = null;
let unsubscribeStore: (() => void) | null = null;
let applyingRemote = false;
let currentCode: string | null = null;

export function connectSync(code: string, onReady?: () => void, onError?: (message: string) => void) {
  disconnectSync();
  currentCode = code;
  const ref = doc(db, 'ledgers', code);
  let firstSnapshot = true;

  unsubscribeSnapshot = onSnapshot(
    ref,
    // 需要 metadata 變化：離線開啟全新空間時，恢復連線後伺服器確認「不存在」只改變 fromCache，
    // 資料本身沒變；不開這個選項就收不到通知，畫面會永遠停在「連線中…」。
    { includeMetadataChanges: true },
    (snap) => {
      // 本機寫入尚未送達的回音：store 已經是這份資料，略過以免重複套用。
      if (snap.metadata.hasPendingWrites) return;
      if (snap.exists()) {
        const { doc: ledger, migrated } = migrateLedgerDoc(snap.data());
        applyingRemote = true;
        useGroupStore.setState(ledger);
        applyingRemote = false;
        if (migrated) {
          setDoc(ref, ledger);
        }
      } else if (snap.metadata.fromCache) {
        // 「不存在」只來自本機快取（例如離線開啟、記憶體快取是空的），不代表雲端沒有帳本。
        // 這時建檔會讓一筆空帳本排進寫入佇列，恢復連線後整份覆寫雲端資料；
        // 所以不建檔、也不進入 ready，等伺服器給出答案。
        return;
      } else {
        // 伺服器確認不存在才建檔，並用 transaction 確保只在文件仍不存在時寫入，
        // 避免覆寫其他裝置在這段期間剛寫入的帳本。
        createLedgerIfMissing(ref).catch((error) => {
          console.error('Firestore create ledger error:', error);
        });
      }
      if (firstSnapshot) {
        firstSnapshot = false;
        onReady?.();
      }
    },
    (error) => {
      console.error('Firestore sync error:', error);
      onError?.(error.message);
    },
  );

  unsubscribeStore = useGroupStore.subscribe((state) => {
    if (applyingRemote || !currentCode) return;
    setDoc(doc(db, 'ledgers', currentCode), toLedgerDoc(state));
  });
}

export function disconnectSync() {
  unsubscribeSnapshot?.();
  unsubscribeStore?.();
  unsubscribeSnapshot = null;
  unsubscribeStore = null;
  currentCode = null;
  useGroupStore.setState({ members: [], groups: [], expenses: [], settlements: [] });
}
