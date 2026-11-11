import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useBindingStore } from '../store/bindingStore';
import type { LineBinding } from '../types';
import type { BindingMap } from '../utils/lineIdentity';

/** 要綁定的成員已被另一個 LINE 帳號綁定（不允許改綁別人的綁定）。 */
export class BindingTakenError extends Error {
  constructor() {
    super('這位成員已經綁定了其他 LINE 帳號');
    this.name = 'BindingTakenError';
  }
}

const bindingsCol = (code: string) => collection(db, 'ledgers', code, 'lineBindings');

function isBinding(data: unknown): data is LineBinding {
  const d = data as Partial<LineBinding> | null;
  return !!d && typeof d.lineKey === 'string' && typeof d.memberName === 'string';
}

let unsubscribe: (() => void) | null = null;

/**
 * 監聽目前空間的綁定清單。只採用伺服器確認過的結果（離線時快取可能是空的，不能當成「沒有綁定」）。
 * onUpdate 在每次清單更新後呼叫，用來重新決定身分。
 */
export function connectLineBindings(code: string, myLineKey: string | null, onUpdate: () => void) {
  disconnectLineBindings();
  useBindingStore.getState().reset(code, myLineKey);
  unsubscribe = onSnapshot(
    bindingsCol(code),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.fromCache && !useBindingStore.getState().ready) return;
      const bindings: BindingMap = {};
      snap.forEach((d) => {
        const data = d.data();
        if (isBinding(data)) bindings[d.id] = data;
      });
      useBindingStore.getState().setBindings(bindings);
      onUpdate();
    },
    (error) => {
      // 讀取被拒（例如安全規則尚未開放）時，視為沒有綁定，不擋住使用者。
      console.error('LINE 綁定讀取失敗：', error);
      useBindingStore.getState().setBindingsError();
      onUpdate();
    },
  );
}

export function disconnectLineBindings() {
  unsubscribe?.();
  unsubscribe = null;
}

/** 反向索引：ledgers/{code}/lineKeys/{lineKey} = { memberId }。讓同一個 LINE 帳號的並發綁定在同一份文件上衝突。 */
const lineKeyRef = (code: string, lineKey: string) => doc(db, 'ledgers', code, 'lineKeys', lineKey);

/**
 * 把這個 LINE 帳號綁到 memberId（全部在一個 transaction 內完成）。
 * - 該成員已被別的 LINE 帳號綁定：丟出 BindingTakenError（兩支手機同時綁同一人只會成功一個）。
 * - 這個 LINE 帳號原本綁在別的成員：一併移除，但只在那筆綁定仍屬於自己時才刪（不會刪到別人的）。
 * - 同一個 LINE 帳號兩台裝置同時綁不同成員：兩邊都讀寫反向索引，transaction 衝突重試後只留一筆。
 */
export async function bindMember(code: string, memberId: string, memberName: string, myLineKey: string) {
  await runTransaction(db, async (tx) => {
    const ref = doc(bindingsCol(code), memberId);
    const keyRef = lineKeyRef(code, myLineKey);
    // transaction 規定：所有讀取都要在寫入之前。
    const current = await tx.get(ref);
    const index = await tx.get(keyRef);
    const previousId: unknown = index.exists() ? index.data().memberId : null;
    const previous =
      typeof previousId === 'string' && previousId !== memberId ? await tx.get(doc(bindingsCol(code), previousId)) : null;

    if (current.exists() && current.data().lineKey !== myLineKey) throw new BindingTakenError();
    if (previous?.exists() && previous.data().lineKey === myLineKey) tx.delete(previous.ref);

    // memberName 只當補回成員時的後備名稱；配合安全規則限制在 50 字內。
    const binding: LineBinding = {
      lineKey: myLineKey,
      memberName: memberName.slice(0, 50),
      boundAt: new Date().toISOString(),
      v: 1,
    };
    tx.set(keyRef, { memberId, v: 1 });
    tx.set(ref, binding);
  });
}

/** 解除這個 LINE 帳號在此空間的綁定（只能解除自己的；成員綁定若已換成別人的 lineKey 就不動）。 */
export async function unbindMine(code: string, myLineKey: string) {
  // 也找出沒有反向索引的舊綁定（保險起見），在 transaction 內逐筆確認仍屬於自己才刪。
  const found = await getDocs(query(bindingsCol(code), where('lineKey', '==', myLineKey)));
  await runTransaction(db, async (tx) => {
    const keyRef = lineKeyRef(code, myLineKey);
    const index = await tx.get(keyRef);
    const ids = new Set(found.docs.map((d) => d.id));
    const indexed: unknown = index.exists() ? index.data().memberId : null;
    if (typeof indexed === 'string') ids.add(indexed);
    const snaps = await Promise.all([...ids].map((id) => tx.get(doc(bindingsCol(code), id))));
    snaps.forEach((s) => {
      if (s.exists() && s.data().lineKey === myLineKey) tx.delete(s.ref);
    });
    if (index.exists()) tx.delete(keyRef);
  });
}
