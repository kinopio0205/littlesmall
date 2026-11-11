import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, doc, getDocFromServer, getFirestore, setLogLevel, type Firestore } from 'firebase/firestore';
import { computeUserSpacesKey, loadLineSpaces, removeLineSpace, upsertLineSpace } from './lineSpacesSync';

// 需在 Firestore Emulator 下執行：`npm test`。
vi.mock('../firebase', async () => {
  const { initializeApp: init } = await import('firebase/app');
  const { getFirestore: get, connectFirestoreEmulator: connect } = await import('firebase/firestore');
  const db = get(init({ projectId: 'demo-ledger-test', apiKey: 'demo' }, 'spaces-under-test'));
  connect(db, '127.0.0.1', 8085);
  return { db, firebaseApp: {} };
});

let other: Firestore;
let seq = 0;
const freshUser = () => `Uspaces${++seq}${Math.floor(Math.random() * 1e6)}`;

beforeAll(() => {
  setLogLevel('silent');
  other = getFirestore(initializeApp({ projectId: 'demo-ledger-test', apiKey: 'demo' }, 'spaces-other'));
  connectFirestoreEmulator(other, '127.0.0.1', 8085);
});

describe('computeUserSpacesKey', () => {
  it('SHA-256("line-spaces:" + userId)，不含 userId 原文', async () => {
    // 已知值由 Node 的 crypto 獨立算出
    expect(await computeUserSpacesKey('U123')).toBe('400c548d1329db051a34cea067a221522278d48545eea4bd34a5b3ad9bc5d428');
  });
});

describe('lineSpaces 清單', () => {
  it('沒有清單時回傳空物件', async () => {
    expect(await loadLineSpaces(await computeUserSpacesKey(freshUser()))).toEqual({});
  });

  it('新增與讀取；同一空間更新名字', async () => {
    const key = await computeUserSpacesKey(freshUser());
    await upsertLineSpace(key, 'AAAA', '小明');
    await upsertLineSpace(key, 'BBBB', '小華');
    await upsertLineSpace(key, 'AAAA', '小明明');
    const spaces = await loadLineSpaces(key);
    expect(Object.keys(spaces).sort()).toEqual(['AAAA', 'BBBB']);
    expect(spaces.AAAA.memberName).toBe('小明明');
  });

  it('兩台裝置同時新增不同空間：兩筆都保留（欄位層級合併，不整份覆寫）', async () => {
    const key = await computeUserSpacesKey(freshUser());
    await Promise.all([upsertLineSpace(key, 'CCCC', '甲'), upsertLineSpace(key, 'DDDD', '乙')]);
    const snap = await getDocFromServer(doc(other, 'lineSpaces', key));
    expect(Object.keys(snap.data()?.spaces ?? {}).sort()).toEqual(['CCCC', 'DDDD']);
  });

  it('移除單一空間，其他保留；移除不存在的清單不出錯', async () => {
    const key = await computeUserSpacesKey(freshUser());
    await upsertLineSpace(key, 'EEEE', '甲');
    await upsertLineSpace(key, 'FFFF', '乙');
    await removeLineSpace(key, 'EEEE');
    expect(Object.keys(await loadLineSpaces(key))).toEqual(['FFFF']);
    await expect(removeLineSpace(await computeUserSpacesKey(freshUser()), 'GGGG')).resolves.toBeUndefined();
  });
});
