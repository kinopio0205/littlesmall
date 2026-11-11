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
