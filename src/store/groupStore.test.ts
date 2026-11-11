import { beforeEach, describe, expect, it } from 'vitest';
import { useGroupStore } from './groupStore';

beforeEach(() => {
  useGroupStore.setState({ members: [{ id: 'm1', name: '小明' }], groups: [], expenses: [], settlements: [] });
});

describe('addRosterMemberStrict', () => {
  it('新名字會加入名單並回傳新 id', () => {
    const id = useGroupStore.getState().addRosterMemberStrict(' 小華 ');
    expect(id).toBeTruthy();
    expect(useGroupStore.getState().members).toContainEqual({ id, name: '小華' });
  });

  it('同名時拒絕（回傳 null），不會把使用者對應到既有的同名成員', () => {
    expect(useGroupStore.getState().addRosterMemberStrict('小明')).toBeNull();
    expect(useGroupStore.getState().members).toHaveLength(1);
  });

  it('空白名字回傳 null', () => {
    expect(useGroupStore.getState().addRosterMemberStrict('   ')).toBeNull();
  });
});

describe('ensureRosterMember', () => {
  it('以指定 id 補回不在名單中的成員', () => {
    useGroupStore.getState().ensureRosterMember({ id: 'm9', name: '阿美' });
    expect(useGroupStore.getState().members).toContainEqual({ id: 'm9', name: '阿美' });
  });

  it('已存在的 id 不重複加入、不改名', () => {
    useGroupStore.getState().ensureRosterMember({ id: 'm1', name: '改名' });
    expect(useGroupStore.getState().members).toEqual([{ id: 'm1', name: '小明' }]);
  });
});

describe('addGroupMember（記帳前自動加入群組）', () => {
  it('不在群組時加入，已在群組時不重複', () => {
    useGroupStore.setState({
      members: [{ id: 'm1', name: '小明' }, { id: 'm2', name: '小華' }],
      groups: [{ id: 'g1', name: '旅行', icon: '✈️', memberIds: ['m1'], createdAt: '' }],
      expenses: [],
      settlements: [],
    });
    useGroupStore.getState().addGroupMember('g1', 'm2');
    useGroupStore.getState().addGroupMember('g1', 'm2');
    expect(useGroupStore.getState().groups[0].memberIds).toEqual(['m1', 'm2']);
  });
});
