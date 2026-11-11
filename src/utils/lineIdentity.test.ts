import { describe, expect, it } from 'vitest';
import { computeLineKey, findMyBinding, planLineResolution, suggestMemberForLineName } from './lineIdentity';
import type { LineBinding } from '../types';
import type { Member } from '../types';

const roster: Member[] = [
  { id: 'm1', name: '小明' },
  { id: 'm2', name: '小華' },
];

const KEY = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);

function binding(lineKey: string, memberName: string): LineBinding {
  return { lineKey, memberName, boundAt: '2026-11-11T00:00:00.000Z', v: 1 };
}

describe('computeLineKey', () => {
  it('SHA-256(code:userId) 的 64 字元十六進位，同輸入結果相同、不同空間結果不同', async () => {
    const a = await computeLineKey('ABCD', 'U123');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await computeLineKey('ABCD', 'U123')).toBe(a);
    expect(await computeLineKey('WXYZ', 'U123')).not.toBe(a);
    // 已知值：sha256("ABCD:U123")，由 Node 的 crypto 獨立算出
    expect(a).toBe('7798782cb40e0252962754ae87b831126017c815d9cb08dcbcf24c736ebdabd0');
  });
});

describe('findMyBinding', () => {
  it('找出屬於這個 LINE 帳號的綁定', () => {
    const bindings = { m1: binding(OTHER, '小明'), m2: binding(KEY, '小華') };
    expect(findMyBinding(bindings, KEY)).toEqual({ memberId: 'm2', binding: bindings.m2 });
    expect(findMyBinding(bindings, 'c'.repeat(64))).toBeNull();
  });
});

describe('planLineResolution', () => {
  it('已綁定且成員在名單中：自動設定身分並提示', () => {
    expect(
      planLineResolution({ roster, bindings: { m2: binding(KEY, '小華') }, myLineKey: KEY, currentMemberId: undefined, overridden: false }),
    ).toEqual({ setMemberId: 'm2', restore: null, notice: '已用 LINE 自動辨識：小華' });
  });

  it('已綁定且已經是這個身分：不做事', () => {
    expect(
      planLineResolution({ roster, bindings: { m2: binding(KEY, '小華') }, myLineKey: KEY, currentMemberId: 'm2', overridden: false }),
    ).toEqual({ setMemberId: null, restore: null, notice: null });
  });

  it('綁定的成員被整份覆寫弄丟：用原 id 與記下的名字補回，再設定身分', () => {
    expect(
      planLineResolution({ roster, bindings: { m9: binding(KEY, '阿美') }, myLineKey: KEY, currentMemberId: undefined, overridden: false }),
    ).toEqual({ setMemberId: 'm9', restore: { id: 'm9', name: '阿美' }, notice: '已用 LINE 自動辨識：阿美' });
  });

  it('補回時名字若已被別的成員使用，加上標記避免同名', () => {
    expect(
      planLineResolution({ roster, bindings: { m9: binding(KEY, '小明') }, myLineKey: KEY, currentMemberId: undefined, overridden: false }),
    ).toEqual({ setMemberId: 'm9', restore: { id: 'm9', name: '小明（LINE）' }, notice: '已用 LINE 自動辨識：小明（LINE）' });
  });

  it('本次工作階段手動切換過身分：不自動設回', () => {
    expect(
      planLineResolution({ roster, bindings: { m2: binding(KEY, '小華') }, myLineKey: KEY, currentMemberId: 'm1', overridden: true }),
    ).toEqual({ setMemberId: null, restore: null, notice: null });
  });

  it('沒有綁定或沒有 LINE：不做事', () => {
    expect(
      planLineResolution({ roster, bindings: { m1: binding(OTHER, '小明') }, myLineKey: KEY, currentMemberId: undefined, overridden: false }),
    ).toEqual({ setMemberId: null, restore: null, notice: null });
    expect(planLineResolution({ roster, bindings: {}, myLineKey: null, currentMemberId: undefined, overridden: false })).toEqual({
      setMemberId: null,
      restore: null,
      notice: null,
    });
  });
});

describe('suggestMemberForLineName', () => {
  it('名稱正規化後相同、且沒被別人綁定的成員', () => {
    expect(suggestMemberForLineName(roster, {}, ' 小華 ')?.id).toBe('m2');
    expect(suggestMemberForLineName([{ id: 'x', name: 'Ming' }], {}, 'ming')?.id).toBe('x');
  });

  it('已被別人綁定或沒有相符名字時不建議', () => {
    expect(suggestMemberForLineName(roster, { m2: binding(OTHER, '小華') }, '小華')).toBeUndefined();
    expect(suggestMemberForLineName(roster, {}, '路人')).toBeUndefined();
  });
});
