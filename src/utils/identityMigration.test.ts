import { describe, expect, it } from 'vitest';
import { migrateIdentity } from '../store/identityStore';
import { migrateRecentSpaces, upsertRecentSpace, type RecentSpace } from '../store/lastSpaceStore';
import { planLegacyMigration } from './identityMigration';
import { getGroupsForIdentity, getMemberInGroup } from './identity';
import type { Group, Member } from '../types';

const roster: Member[] = [
  { id: 'm1', name: '小明' },
  { id: 'm2', name: '小華' },
];

describe('migrateIdentity（localStorage ledger-identity）', () => {
  it('v0 的名字字串轉成待遷移的 legacyName，byCode 為空', () => {
    expect(migrateIdentity({ name: ' 小明 ' }, 0)).toEqual({ byCode: {}, legacyName: '小明' });
  });

  it('v0 沒有名字時 legacyName 為 null', () => {
    expect(migrateIdentity({ name: null }, 0)).toEqual({ byCode: {}, legacyName: null });
    expect(migrateIdentity(undefined, 0)).toEqual({ byCode: {}, legacyName: null });
  });

  it('v1 原樣保留', () => {
    expect(migrateIdentity({ byCode: { ABCD: 'm1' }, legacyName: null }, 1)).toEqual({
      byCode: { ABCD: 'm1' },
      legacyName: null,
      noLineAskByCode: {},
    });
    expect(
      migrateIdentity({ byCode: {}, legacyName: null, noLineAskByCode: { ABCD: true } }, 1).noLineAskByCode,
    ).toEqual({ ABCD: true });
  });
});

describe('migrateRecentSpaces（localStorage ledger-last-space）', () => {
  it('v0 的 lastSpace 轉成一筆 recentSpaces，名字同時作為顯示名與待遷移名', () => {
    expect(migrateRecentSpaces({ lastSpace: { code: 'ABCD', identity: '小明' } }, 0)).toEqual({
      recentSpaces: [{ code: 'ABCD', memberName: '小明', legacyName: '小明', lastUsedAt: 0 }],
    });
  });

  it('v0 沒有 lastSpace 時為空清單', () => {
    expect(migrateRecentSpaces({ lastSpace: null }, 0)).toEqual({ recentSpaces: [] });
    expect(migrateRecentSpaces(undefined, 0)).toEqual({ recentSpaces: [] });
  });
});

describe('upsertRecentSpace', () => {
  it('新空間放最前面，同一空間不重複，最多保留 5 筆', () => {
    let list: RecentSpace[] = [];
    for (let i = 1; i <= 6; i++) list = upsertRecentSpace(list, { code: `C${i}`, lastUsedAt: i });
    expect(list.map((s) => s.code)).toEqual(['C6', 'C5', 'C4', 'C3', 'C2']);

    list = upsertRecentSpace(list, { code: 'C4', memberName: '小明', lastUsedAt: 7 });
    expect(list.map((s) => s.code)).toEqual(['C4', 'C6', 'C5', 'C3', 'C2']);
    expect(list[0]).toEqual({ code: 'C4', memberName: '小明', lastUsedAt: 7 });
  });
});

describe('planLegacyMigration', () => {
  it('已經有這個空間的 memberId 時不改動，但仍會消耗全域 legacyName', () => {
    expect(
      planLegacyMigration({ code: 'ABCD', byCode: { ABCD: 'm2' }, legacyName: '小明', recentSpaces: [], roster }),
    ).toEqual({ memberId: undefined, clearGlobalLegacy: true, clearRecentLegacy: false });
  });

  it('用全域 legacyName 在目前空間的名單找到成員', () => {
    expect(planLegacyMigration({ code: 'ABCD', byCode: {}, legacyName: '小華', recentSpaces: [], roster })).toEqual({
      memberId: 'm2',
      clearGlobalLegacy: true,
      clearRecentLegacy: false,
    });
  });

  it('沒有全域 legacyName 時，改用 recentSpaces 中這個空間的 legacyName', () => {
    const recentSpaces: RecentSpace[] = [{ code: 'ABCD', memberName: '小明', legacyName: '小明', lastUsedAt: 0 }];
    expect(planLegacyMigration({ code: 'ABCD', byCode: {}, legacyName: null, recentSpaces, roster })).toEqual({
      memberId: 'm1',
      clearGlobalLegacy: false,
      clearRecentLegacy: true,
    });
  });

  it('名單裡找不到名字時不設定身分，但仍清掉待遷移名，讓使用者重選', () => {
    expect(planLegacyMigration({ code: 'ABCD', byCode: {}, legacyName: '路人', recentSpaces: [], roster })).toEqual({
      memberId: undefined,
      clearGlobalLegacy: true,
      clearRecentLegacy: false,
    });
  });

  it('這個空間自己記下的名字優先於全域名字（舊版「重新輸入同步碼」不會清身分）', () => {
    const recentSpaces: RecentSpace[] = [{ code: 'ABCD', memberName: '小明', legacyName: '小明', lastUsedAt: 0 }];
    expect(planLegacyMigration({ code: 'ABCD', byCode: {}, legacyName: '小華', recentSpaces, roster })).toEqual({
      memberId: 'm1',
      clearGlobalLegacy: true,
      clearRecentLegacy: true,
    });
  });

  it('其他空間的 recent legacyName 不會被套用或清掉', () => {
    const recentSpaces: RecentSpace[] = [{ code: 'WXYZ', legacyName: '小明', lastUsedAt: 0 }];
    expect(planLegacyMigration({ code: 'ABCD', byCode: {}, legacyName: null, recentSpaces, roster })).toEqual({
      memberId: undefined,
      clearGlobalLegacy: false,
      clearRecentLegacy: false,
    });
  });
});

describe('identity utils 以 memberId 比對', () => {
  const groups: Group[] = [
    { id: 'g1', name: '旅行', icon: '✈️', memberIds: ['m1', 'm2'], createdAt: '' },
    { id: 'g2', name: '午餐', icon: '🍱', memberIds: ['m2'], createdAt: '' },
  ];

  it('getMemberInGroup 用 id 找成員，不在群組時回傳 undefined', () => {
    expect(getMemberInGroup(groups[0], roster, 'm1')?.name).toBe('小明');
    expect(getMemberInGroup(groups[1], roster, 'm1')).toBeUndefined();
  });

  it('同名不同 id 時，只依 id 判斷', () => {
    const dupRoster: Member[] = [...roster, { id: 'm3', name: '小明' }];
    const g: Group = { id: 'g3', name: 'x', icon: '', memberIds: ['m3'], createdAt: '' };
    expect(getMemberInGroup(g, dupRoster, 'm1')).toBeUndefined();
    expect(getMemberInGroup(g, dupRoster, 'm3')?.id).toBe('m3');
  });

  it('getGroupsForIdentity 回傳該成員所在的群組', () => {
    expect(getGroupsForIdentity(groups, roster, 'm1').map((g) => g.id)).toEqual(['g1']);
    expect(getGroupsForIdentity(groups, roster, 'm2').map((g) => g.id)).toEqual(['g1', 'g2']);
  });
});
