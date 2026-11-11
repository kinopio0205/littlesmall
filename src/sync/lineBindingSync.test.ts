import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initializeApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  getDocsFromServer,
  getFirestore,
  setDoc,
  setLogLevel,
  type Firestore,
} from 'firebase/firestore';
import { BindingTakenError, bindMember, connectLineBindings, disconnectLineBindings, unbindMine } from './lineBindingSync';
import { useBindingStore } from '../store/bindingStore';

// 需在 Firestore Emulator 下執行：`npm test`。
vi.mock('../firebase', async () => {
  const { initializeApp: init } = await import('firebase/app');
  const { getFirestore: get, connectFirestoreEmulator: connect } = await import('firebase/firestore');
  const db = get(init({ projectId: 'demo-ledger-test', apiKey: 'demo' }, 'binding-under-test'));
  connect(db, '127.0.0.1', 8085);
  return { db, firebaseApp: {} };
});

const MINE = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const WAIT = { timeout: 30000, interval: 100 };

let other: Firestore;
let seq = 0;
function freshCode() {
  seq += 1;
  return `BIND${seq}${Math.floor(Math.random() * 1e6)}`;
}
const bindingRef = (code: string, memberId: string) => doc(other, 'ledgers', code, 'lineBindings', memberId);

beforeAll(() => {
  setLogLevel('silent');
  other = getFirestore(initializeApp({ projectId: 'demo-ledger-test', apiKey: 'demo' }, 'binding-other'));
  connectFirestoreEmulator(other, '127.0.0.1', 8085);
});

afterEach(() => {
  disconnectLineBindings();
});

describe('bindMember', () => {
  it('綁定沒人綁的成員：以 memberId 為文件 id 寫入 lineKey 與名字', async () => {
    const code = freshCode();
    await bindMember(code, 'm1', '小明', MINE);
    const snap = await getDocFromServer(bindingRef(code, 'm1'));
    expect(snap.data()).toMatchObject({ lineKey: MINE, memberName: '小明', v: 1 });
  });

  it('成員已被別的 LINE 帳號綁定：拒絕，原綁定不變（不允許改綁）', async () => {
    const code = freshCode();
    await setDoc(bindingRef(code, 'm1'), { lineKey: OTHER, memberName: '小明', boundAt: 'x', v: 1 });
    await expect(bindMember(code, 'm1', '小明', MINE)).rejects.toBeInstanceOf(BindingTakenError);
    expect((await getDocFromServer(bindingRef(code, 'm1'))).data()?.lineKey).toBe(OTHER);
  });

  it('同一個 LINE 帳號改綁到另一個成員：原本自己的綁定會移除（一人一個成員）', async () => {
    const code = freshCode();
    await bindMember(code, 'm1', '小明', MINE);
    await bindMember(code, 'm2', '小華', MINE);
    const all = await getDocsFromServer(collection(other, 'ledgers', code, 'lineBindings'));
    expect(all.docs.map((d) => [d.id, d.data().lineKey])).toEqual([['m2', MINE]]);
  });

  it('同一個 LINE 帳號在兩台裝置同時綁不同成員：最後只留一筆綁定，且與反向索引一致', async () => {
    const code = freshCode();
    await Promise.allSettled([bindMember(code, 'm1', '小明', MINE), bindMember(code, 'm2', '小華', MINE)]);
    const all = await getDocsFromServer(collection(other, 'ledgers', code, 'lineBindings'));
    const mine = all.docs.filter((d) => d.data().lineKey === MINE).map((d) => d.id);
    expect(mine).toHaveLength(1);
    const index = await getDocFromServer(doc(other, 'ledgers', code, 'lineKeys', MINE));
    expect(index.data()?.memberId).toBe(mine[0]);
  });

  it('改綁時不會刪掉已換成別人 lineKey 的舊成員綁定', async () => {
    const code = freshCode();
    await bindMember(code, 'm1', '小明', MINE);
    // 模擬：舊成員 m1 的綁定在這段期間被換成別人（例如自己在別台解除、別人再綁）
    await setDoc(bindingRef(code, 'm1'), { lineKey: OTHER, memberName: '小明', boundAt: 'x', v: 1 });
    await bindMember(code, 'm2', '小華', MINE);
    expect((await getDocFromServer(bindingRef(code, 'm1'))).data()?.lineKey).toBe(OTHER);
    expect((await getDocFromServer(bindingRef(code, 'm2'))).data()?.lineKey).toBe(MINE);
  });

  it('重複綁定同一個成員不會出錯', async () => {
    const code = freshCode();
    await bindMember(code, 'm1', '小明', MINE);
    await bindMember(code, 'm1', '小明', MINE);
    expect((await getDocFromServer(bindingRef(code, 'm1'))).data()?.lineKey).toBe(MINE);
  });
});

describe('unbindMine', () => {
  it('只刪除自己的綁定，別人的保留', async () => {
    const code = freshCode();
    await setDoc(bindingRef(code, 'm2'), { lineKey: OTHER, memberName: '小華', boundAt: 'x', v: 1 });
    await bindMember(code, 'm1', '小明', MINE);
    await unbindMine(code, MINE);
    const all = await getDocsFromServer(collection(other, 'ledgers', code, 'lineBindings'));
    expect(all.docs.map((d) => d.id)).toEqual(['m2']);
    expect((await getDocFromServer(doc(other, 'ledgers', code, 'lineKeys', MINE))).exists()).toBe(false);
  });

  it('解除時若成員綁定已換成別人的 lineKey，不會刪掉別人的綁定', async () => {
    const code = freshCode();
    await bindMember(code, 'm1', '小明', MINE);
    await setDoc(bindingRef(code, 'm1'), { lineKey: OTHER, memberName: '小明', boundAt: 'x', v: 1 });
    await unbindMine(code, MINE);
    expect((await getDocFromServer(bindingRef(code, 'm1'))).data()?.lineKey).toBe(OTHER);
  });
});

describe('connectLineBindings', () => {
  it('載入綁定清單並在變動時更新', async () => {
    const code = freshCode();
    await setDoc(bindingRef(code, 'm2'), { lineKey: OTHER, memberName: '小華', boundAt: 'x', v: 1 });
    const onUpdate = vi.fn();
    connectLineBindings(code, MINE, onUpdate);
    await vi.waitFor(() => expect(useBindingStore.getState().ready).toBe(true), WAIT);
    expect(Object.keys(useBindingStore.getState().bindings)).toEqual(['m2']);
    expect(useBindingStore.getState().myLineKey).toBe(MINE);

    await bindMember(code, 'm1', '小明', MINE);
    await vi.waitFor(() => expect(Object.keys(useBindingStore.getState().bindings).sort()).toEqual(['m1', 'm2']), WAIT);
    expect(onUpdate).toHaveBeenCalled();
  });

  it('忽略格式不正確的文件', async () => {
    const code = freshCode();
    await setDoc(bindingRef(code, 'bad'), { lineKey: 123, memberName: '壞資料' });
    await setDoc(bindingRef(code, 'm1'), { lineKey: OTHER, memberName: '小明', boundAt: 'x', v: 1 });
    connectLineBindings(code, MINE, () => {});
    await vi.waitFor(() => expect(useBindingStore.getState().ready).toBe(true), WAIT);
    expect(Object.keys(useBindingStore.getState().bindings)).toEqual(['m1']);
  });
});
