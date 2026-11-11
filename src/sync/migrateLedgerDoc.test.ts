import { describe, expect, it, vi } from 'vitest';

// 純函式測試，不需要連線；避免載入正式的 Firebase 設定。
vi.mock('../firebase', () => ({ db: {}, firebaseApp: {} }));

const { migrateLedgerDoc } = await import('./firestoreSync');

const legacyRaw = {
  groups: [
    { id: 'g1', name: '旅行', icon: '✈️', createdAt: '', members: [{ id: 'a', name: '小明' }, { id: 'b', name: '小華' }] },
    { id: 'g2', name: '午餐', icon: '🍱', createdAt: '', members: [{ id: 'x', name: '小明' }] },
  ],
  expenses: [
    { id: 'e1', groupId: 'g1', description: '晚餐', amount: 600, payerId: 'a', date: '', splitType: 'equal', icon: '',
      splits: [{ memberId: 'a', amount: 300 }, { memberId: 'b', amount: 300 }] },
  ],
  settlements: [{ id: 's1', groupId: 'g2', fromMemberId: 'x', toMemberId: 'x', amount: 1, date: '' }],
};

describe('migrateLedgerDoc（群組內嵌成員的舊格式）', () => {
  it('多台裝置各自遷移同一份舊資料，產生完全相同的結果（roster id 是確定性的）', () => {
    const first = migrateLedgerDoc(structuredClone(legacyRaw));
    const second = migrateLedgerDoc(structuredClone(legacyRaw));
    expect(first.migrated).toBe(true);
    expect(second.doc).toEqual(first.doc);
  });

  it('同名成員合併成同一個 roster 成員，支出與還款改指向新 id', () => {
    const { doc } = migrateLedgerDoc(structuredClone(legacyRaw));
    expect(doc.members.map((m) => m.name)).toEqual(['小明', '小華']);
    const ming = doc.members.find((m) => m.name === '小明')!.id;
    const hua = doc.members.find((m) => m.name === '小華')!.id;
    expect(doc.groups[0].memberIds).toEqual([ming, hua]);
    expect(doc.groups[1].memberIds).toEqual([ming]);
    expect(doc.expenses[0].payerId).toBe(ming);
    expect(doc.expenses[0].splits.map((s) => s.memberId)).toEqual([ming, hua]);
    expect(doc.settlements[0].fromMemberId).toBe(ming);
  });
});
