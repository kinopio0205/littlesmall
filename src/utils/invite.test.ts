import { describe, expect, it } from 'vitest';
import {
  buildCleanEntryUrl,
  hasOAuthError,
  hashHasLiffCredentials,
  isLiffEntry,
  parseInvite,
  parseInviteFromLiffState,
  stripInviteParams,
} from './invite';

describe('parseInvite', () => {
  it('讀取 ?space= 並正規化', () => {
    expect(parseInvite('?space=ab-cd12')).toBe('ABCD12');
  });

  it('相容舊的 ?code=', () => {
    expect(parseInvite('?code=ABCD1234')).toBe('ABCD1234');
  });

  it('同時有 space 與 code 時以 space 為準', () => {
    expect(parseInvite('?space=AAAA&code=BBBB')).toBe('AAAA');
  });

  it('LINE 登入回呼帶的 OAuth code 不會被當成同步碼', () => {
    expect(parseInvite('?src=liff&code=oauthCode123&state=xyz&liffClientId=2012542788')).toBeNull();
    expect(parseInvite('?code=oauthCode123&liffRedirectUri=https%3A%2F%2Fexample.com')).toBeNull();
    expect(parseInvite('?code=oauthCode123&liff.state=%3Fspace%3DAAAA')).toBeNull();
  });

  it('OAuth 回呼中仍可讀到明確的 ?space=', () => {
    expect(parseInvite('?src=liff&space=AAAA&code=oauth&state=xyz&liffClientId=1')).toBe('AAAA');
  });

  it('太短或沒有邀請時回傳 null', () => {
    expect(parseInvite('?space=AB')).toBeNull();
    expect(parseInvite('?src=liff')).toBeNull();
    expect(parseInvite('')).toBeNull();
  });
});

describe('parseInviteFromLiffState（略過 LINE 初始化時的後備）', () => {
  it('從編碼過的 liff.state 讀出 space', () => {
    expect(parseInviteFromLiffState('?src=liff&liff.state=%3Fspace%3DABCD1234')).toBe('ABCD1234');
    expect(parseInviteFromLiffState('?liff.state=%2Fpath%3Fspace%3Dabcd1234%26x%3D1')).toBe('ABCD1234');
  });

  it('沒有 liff.state 時回傳 null', () => {
    expect(parseInviteFromLiffState('?src=liff')).toBeNull();
  });
});

describe('stripInviteParams', () => {
  it('只刪 space 與 code，其他參數原樣保留、不重排、不重新編碼', () => {
    expect(stripInviteParams('?src=liff&space=AAAA&note=%3Fa%3D1+b&code=BBBB&x=1')).toBe(
      '?src=liff&note=%3Fa%3D1+b&x=1',
    );
  });

  it('有 liff.* 參數時保留 code（可能是 LINE 的授權碼），只刪 space', () => {
    expect(stripInviteParams('?src=liff&space=AAAA&liff.state=%3Fa%3D1+b&code=BBBB')).toBe(
      '?src=liff&liff.state=%3Fa%3D1+b&code=BBBB',
    );
  });

  it('刪光時回傳空字串', () => {
    expect(stripInviteParams('?space=AAAA&code=AAAA')).toBe('');
  });

  it('LINE OAuth 回呼的 code 不能刪（liff.init 需要它）', () => {
    expect(stripInviteParams('?src=liff&code=oauth&state=xyz&liffClientId=1')).toBe(
      '?src=liff&code=oauth&state=xyz&liffClientId=1',
    );
  });
});

describe('isLiffEntry', () => {
  it('Endpoint 帶的 src=liff', () => {
    expect(isLiffEntry('?src=liff&space=AAAA', false)).toBe(true);
  });

  it('LIFF 的 primary redirect 參數', () => {
    expect(isLiffEntry('?liff.state=%3Fspace%3DAAAA', false)).toBe(true);
    expect(isLiffEntry('?code=x&liffClientId=1', false)).toBe(true);
  });

  it('外部瀏覽器登入流程中的旗標', () => {
    expect(isLiffEntry('', true)).toBe(true);
  });

  it('一般網址不是 LIFF 入口', () => {
    expect(isLiffEntry('?space=AAAA', false)).toBe(false);
    expect(isLiffEntry('', false)).toBe(false);
  });
});

describe('buildCleanEntryUrl', () => {
  it('只留 space（以及需要時的 src=liff），丟掉 liff.*、OAuth 參數與 hash', () => {
    expect(buildCleanEntryUrl('https://x.github.io', '/littlesmall/', 'ABCD', false)).toBe(
      'https://x.github.io/littlesmall/?space=ABCD',
    );
    expect(buildCleanEntryUrl('https://x.github.io', '/littlesmall/', null, true)).toBe(
      'https://x.github.io/littlesmall/?src=liff',
    );
    expect(buildCleanEntryUrl('https://x.github.io', '/littlesmall/', 'ABCD', true)).toBe(
      'https://x.github.io/littlesmall/?src=liff&space=ABCD',
    );
    expect(buildCleanEntryUrl('https://x.github.io', '/littlesmall/', null, false)).toBe('https://x.github.io/littlesmall/');
  });
});

describe('hasOAuthError', () => {
  it('LINE 登入取消或失敗的回呼', () => {
    expect(hasOAuthError('?src=liff&error=access_denied&error_description=x&liffOAuth2Error=true')).toBe(true);
    expect(hasOAuthError('?src=liff&liffOAuth2Error=true')).toBe(true);
    expect(hasOAuthError('?src=liff&space=ABCD')).toBe(false);
  });
});

describe('hashHasLiffCredentials', () => {
  it('偵測 LIFF 放在 hash 的憑證', () => {
    expect(hashHasLiffCredentials('#access_token=a&context_token=b')).toBe(true);
    expect(hashHasLiffCredentials('#feature_token=x')).toBe(true);
    expect(hashHasLiffCredentials('#/groups')).toBe(false);
    expect(hashHasLiffCredentials('')).toBe(false);
  });
});
