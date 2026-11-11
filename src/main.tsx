import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import LiffConnecting from './components/LiffConnecting.tsx';
import { LIFF_ID, clearLoginPending, initLiff, readLiffState, readLoginPending } from './liff/liffClient';
import { useLiffStore } from './store/liffStore';
import {
  applyInvite,
  buildCleanEntryUrl,
  hasOAuthError,
  hashHasLiffCredentials,
  isLiffEntry,
  parseInvite,
  parseInviteFromLiffState,
  stripInviteParams,
} from './utils/invite';

const root = createRoot(document.getElementById('root')!);

function renderApp() {
  root.render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  );
}

/** 從網址拿掉自己的邀請參數（不動其他參數），再套用邀請。 */
function finishInvite(space: string | null, fromLine: boolean) {
  const { pathname, search, hash } = window.location;
  const stripped = stripInviteParams(search);
  if (stripped !== search) window.history.replaceState(window.history.state, '', pathname + stripped + hash);
  if (space) applyInvite(space, fromLine);
}

async function bootstrap() {
  const search = window.location.search;

  // 一般瀏覽：不載入 LINE SDK，行為和以前一樣。
  if (!LIFF_ID || !isLiffEntry(search, readLoginPending())) {
    finishInvite(parseInvite(search), false);
    renderApp();
    return;
  }

  // 從 LINE 進來：liff.init 完成前不讀改網址、不掛 router（LIFF 規定 init 前不可改 URL）。
  let settled = false;
  function settle() {
    if (settled) return false;
    settled = true;
    clearLoginPending();
    return true;
  }

  /** 重新載入到乾淨的網址（不帶 liff.*、OAuth 參數與 hash 憑證），之後背景中的 SDK 就不會再轉址或改網址。 */
  function reloadClean(keepLiff: boolean) {
    const current = window.location.search;
    const space = parseInvite(current) ?? parseInviteFromLiffState(current);
    window.location.replace(buildCleanEntryUrl(window.location.origin, import.meta.env.BASE_URL, space, keepLiff));
  }

  function skip() {
    if (!settle()) return;
    // 不在原頁直接進入：init 仍在背景執行，稍後可能整頁轉址（secondary redirect）或導去登入。
    // 改成重新載入一般網址，下次就不會被判定為 LINE 入口、也不會載入 SDK。
    reloadClean(false);
  }

  root.render(<LiffConnecting onSkip={skip} />);

  try {
    const liff = await initLiff();
    const state = await readLiffState(liff);
    if (!settle()) return; // 使用者已略過：晚到的結果一律丟棄
    useLiffStore.getState().setLiff(state);
    // 只有在 LINE App 內點連結才直接切換空間；外部瀏覽器沿用確認橫幅。
    finishInvite(parseInvite(window.location.search), state.mode === 'client');
  } catch (error) {
    if (!settle()) return;
    if (hasOAuthError(window.location.search)) {
      // 外部瀏覽器取消或登入失敗：錯誤參數留在網址上會讓每次 init 都失敗。
      // 回到不帶錯誤參數的 LINE 入口，讓「用 LINE 登入」按鈕重新出現。
      console.warn('LINE 登入未完成：', error);
      reloadClean(true);
      return;
    }
    console.error('LINE 初始化失敗，改用一般模式：', error);
    useLiffStore.getState().setLiff({ mode: 'off', profile: null, canShare: false });
    const { pathname, search, hash } = window.location;
    // init 沒完成時 SDK 不會清掉 hash 中的 LINE 憑證；先拿掉，避免 HashRouter 把它當成路由。
    if (hashHasLiffCredentials(hash)) window.history.replaceState(window.history.state, '', pathname + search);
    finishInvite(parseInvite(search) ?? parseInviteFromLiffState(search), false);
  }
  renderApp();
}

void bootstrap();
