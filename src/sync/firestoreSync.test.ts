import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  disableNetwork,
  doc,
  enableNetwork,
  getDocFromServer,
  getFirestore,
  setDoc,
  setLogLevel,
  type Firestore,
} from 'firebase/firestore';
import { connectSync, createLedgerIfMissing, disconnectSync } from './firestoreSync';
import { useGroupStore } from '../store/groupStore';
import * as firebaseModule from '../firebase';

// 需在 Firestore Emulator 下執行：`npm test`。
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8085;

// 把 app 用的 db 換成連到 Emulator 的 demo 專案，避免碰到正式資料。
// 每個測試都換一個全新的 Firestore 實例（模擬重新開啟頁面、記憶體快取為空）；
// 同一個實例反覆 disableNetwork/enableNetwork 會觸發 SDK 內部斷言（app 本身不會切換網路）。
vi.mock('../firebase', async () => {
  const { initializeApp: init } = await import('firebase/app');
  const { getFirestore: get, connectFirestoreEmulator: connect, terminate } = await import('firebase/firestore');
  let seq = 0;
  function create() {
    seq += 1;
    const instance = get(init({ projectId: 'demo-ledger-test', apiKey: 'demo' }, `app-under-test-${seq}`));
    connect(instance, '127.0.0.1', 8085);
    return instance;
  }
  let current = create();
  return {
    get db() {
      return current;
    },
    async resetDb() {
      await terminate(current);
      current = create();
    },
  };
});

const testFirebase = firebaseModule as unknown as { db: Firestore; resetDb: () => Promise<void> };
const appDb = () => testFirebase.db;

// Node 版 SDK 經 gRPC 連 Emulator 時，偶爾會有約 10 秒的回應停頓（連單純的 getDocFromServer 也會），
// 與 app 邏輯無關；等待上限放寬到 30 秒，避免單次停頓造成誤判。
const WAIT = { timeout: 30000, interval: 100 };

const seededLedger = {
  members: [
    { id: 'm1', name: '小明' },
    { id: 'm2', name: '小華' },
  ],
  groups: [{ id: 'g1', name: '旅行', icon: '✈️', memberIds: ['m1', 'm2'], createdAt: '2026-11-01' }],
  expenses: [
    {
      id: 'e1',
      groupId: 'g1',
      description: '晚餐',
      amount: 600,
      payerId: 'm1',
      date: '2026-11-02',
      splitType: 'equal',
      splits: [
        { memberId: 'm1', amount: 300 },
        { memberId: 'm2', amount: 300 },
      ],
      icon: '🍜',
    },
  ],
  settlements: [],
};

// 另一台「裝置」：直接讀寫 Emulator，用來佈置資料與檢查伺服器上的真實狀態。
let otherDevice: Firestore;
let codeSeq = 0;
function freshCode() {
  codeSeq += 1;
  return `TEST${codeSeq}${Math.floor(Math.random() * 1e6)}`;
}

beforeAll(() => {
  setLogLevel('silent');
  otherDevice = getFirestore(initializeApp({ projectId: 'demo-ledger-test', apiKey: 'demo' }, 'other-device'));
  connectFirestoreEmulator(otherDevice, EMULATOR_HOST, EMULATOR_PORT);
});

afterEach(async () => {
  disconnectSync();
  await testFirebase.resetDb();
});

describe('connectSync', () => {
  it('離線且無快取時開啟既有空間，恢復連線後不會用空資料覆寫雲端帳本', async () => {
    const code = freshCode();
    await setDoc(doc(otherDevice, 'ledgers', code), seededLedger);

    await disableNetwork(appDb());
    const onReady = vi.fn();
    connectSync(code, onReady);

    // 離線時只能拿到「快取中不存在」的 snapshot，不能當成伺服器的答案。
    await new Promise((r) => setTimeout(r, 1000));
    expect(onReady).not.toHaveBeenCalled();
    expect(useGroupStore.getState().members).toEqual([]);

    await enableNetwork(appDb());
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1), WAIT);
    expect(useGroupStore.getState().members).toHaveLength(2);
    expect(useGroupStore.getState().expenses).toHaveLength(1);

    const server = (await getDocFromServer(doc(otherDevice, 'ledgers', code))).data();
    expect(server?.members).toHaveLength(2);
    expect(server?.groups).toHaveLength(1);
    expect(server?.expenses).toHaveLength(1);
  });

  it('連線中開啟全新空間時，會在雲端建立空帳本並進入 ready', async () => {
    const code = freshCode();
    const onReady = vi.fn();
    connectSync(code, onReady);

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1), WAIT);
    await vi.waitFor(
      async () => {
        const snap = await getDocFromServer(doc(otherDevice, 'ledgers', code));
        expect(snap.exists()).toBe(true);
        expect(snap.data()).toEqual({ members: [], groups: [], expenses: [], settlements: [] });
      },
      WAIT,
    );
  });

  it('離線時開啟全新空間，恢復連線後會進入 ready 並在雲端建立空帳本', async () => {
    const code = freshCode();
    await disableNetwork(appDb());
    const onReady = vi.fn();
    connectSync(code, onReady);

    await new Promise((r) => setTimeout(r, 1000));
    expect(onReady).not.toHaveBeenCalled();

    // 恢復連線後伺服器確認「不存在」：資料沒變、只有 metadata（fromCache）改變，也必須收到通知。
    await enableNetwork(appDb());
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1), WAIT);
    await vi.waitFor(
      async () => {
        const snap = await getDocFromServer(doc(otherDevice, 'ledgers', code));
        expect(snap.exists()).toBe(true);
      },
      WAIT,
    );
  });

});

describe('createLedgerIfMissing', () => {
  it('文件已存在時（例如別的裝置剛寫入）不會用空帳本覆寫', async () => {
    const code = freshCode();
    await setDoc(doc(otherDevice, 'ledgers', code), seededLedger);

    await createLedgerIfMissing(doc(appDb(), 'ledgers', code));

    const server = (await getDocFromServer(doc(otherDevice, 'ledgers', code))).data();
    expect(server?.members).toHaveLength(2);
    expect(server?.expenses).toHaveLength(1);
  });

  it('文件不存在時建立空帳本，且不會寫入當下 store 的資料', async () => {
    const code = freshCode();
    // 模擬建檔等待期間使用者已切到別的空間，store 裡是另一個空間的資料。
    useGroupStore.setState(seededLedger as never);

    await createLedgerIfMissing(doc(appDb(), 'ledgers', code));

    const server = (await getDocFromServer(doc(otherDevice, 'ledgers', code))).data();
    expect(server).toEqual({ members: [], groups: [], expenses: [], settlements: [] });
  });
});
