import { describe, expect, it } from 'vitest';
import { buildLineShareUrl, buildLiffInviteUrl, buildShareText, isMobileDevice } from './share';

describe('buildLiffInviteUrl', () => {
  it('LINE MINI App 連結帶 ?space=，從 LINE 開啟可自動辨識', () => {
    expect(buildLiffInviteUrl('2012542790-nxSnSjGn', 'ABCD1234')).toBe(
      'https://miniapp.line.me/2012542790-nxSnSjGn?space=ABCD1234',
    );
  });
});

describe('buildShareText', () => {
  it('包含邀請連結與說明', () => {
    const text = buildShareText('https://miniapp.line.me/x?space=ABCD');
    expect(text).toContain('https://miniapp.line.me/x?space=ABCD');
    expect(text).toContain('小呆記帳');
  });
});

describe('buildLineShareUrl', () => {
  it('用 LINE 的分享網址並正確編碼文字（含換行、?、&）', () => {
    const url = buildLineShareUrl('一起分帳\nhttps://a.b/?space=X&code=X');
    expect(url.startsWith('https://line.me/R/share?text=')).toBe(true);
    expect(decodeURIComponent(url.slice('https://line.me/R/share?text='.length))).toBe('一起分帳\nhttps://a.b/?space=X&code=X');
  });
});

describe('isMobileDevice（line.me/R/share 只支援手機）', () => {
  it('iPhone、Android、iPad 視為手機', () => {
    expect(isMobileDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari Line/14.0.0', 5)).toBe(true);
    expect(isMobileDevice('Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/130 Mobile', 5)).toBe(true);
    expect(isMobileDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 5)).toBe(true);
  });

  it('iPadOS 的桌面版 UA（Macintosh＋觸控）視為手機', () => {
    expect(isMobileDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', 5)).toBe(true);
  });

  it('桌機與 LINE PC 版不是手機', () => {
    expect(isMobileDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130', 0)).toBe(false);
    expect(isMobileDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130', 0)).toBe(false);
    expect(isMobileDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Line/9.0.0', 0)).toBe(false);
  });
});
