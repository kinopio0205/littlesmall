import { useEffect } from 'react';
import { useLiffStore } from '../store/liffStore';
import { useSyncStore } from '../store/syncStore';
import { useBindingStore } from '../store/bindingStore';
import { useGroupStore } from '../store/groupStore';
import { MAX_LINE_SPACES, useLineSpacesStore } from '../store/lineSpacesStore';
import { computeUserSpacesKey, loadLineSpaces, removeLineSpace, upsertLineSpace } from '../sync/lineSpacesSync';
import { findMyBinding } from '../utils/lineIdentity';

/**
 * 維護「這個 LINE 帳號的分帳空間」雲端清單：
 * - 登入 LINE 後讀取清單（切換空間畫面會列出）。
 * - 在某個空間綁定了 LINE（含之前就綁好的）：加入或更新清單。
 * - 在某個空間沒有自己的綁定（解除了）：從清單移除。
 * 只在綁定清單由伺服器確認後判斷，避免離線或載入中誤刪。
 */
export function useLineSpacesSync() {
  const lineUserId = useLiffStore((s) => s.profile?.userId);
  const code = useSyncStore((s) => s.code);
  // 只採用伺服器確認的綁定清單；讀取失敗（error）時不據此新增或刪除清單項目。
  const bindingsReady = useBindingStore((s) => s.ready && !s.error && s.code === code && !!s.myLineKey);
  const bindings = useBindingStore((s) => s.bindings);
  const myLineKey = useBindingStore((s) => s.myLineKey);
  const roster = useGroupStore((s) => s.members);
  const key = useLineSpacesStore((s) => s.key);
  const loaded = useLineSpacesStore((s) => s.loaded);
  const listed = useLineSpacesStore((s) => (code ? s.spaces[code] : undefined));

  const failed = useLineSpacesStore((s) => s.failed);
  const retryToken = useLineSpacesStore((s) => s.retryToken);
  const listedCount = useLineSpacesStore((s) => Object.keys(s.spaces).length);

  // 登入 LINE 後讀取清單；失敗時記下（畫面可重試），恢復連線時自動重試。
  useEffect(() => {
    if (!lineUserId) {
      useLineSpacesStore.getState().reset();
      return;
    }
    let cancelled = false;
    computeUserSpacesKey(lineUserId)
      .then(async (k) => {
        try {
          const spaces = await loadLineSpaces(k);
          if (!cancelled) useLineSpacesStore.getState().setLoaded(k, spaces);
        } catch (error) {
          console.warn("讀取 LINE 空間清單失敗：", error);
          if (!cancelled) useLineSpacesStore.getState().setFailed(k);
        }
      })
      .catch((error) => {
        console.warn("無法計算 LINE 空間清單識別碼：", error);
        if (!cancelled) useLineSpacesStore.getState().setFailed(null);
      });
    const onOnline = () => {
      if (useLineSpacesStore.getState().failed) useLineSpacesStore.getState().retry();
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [lineUserId, retryToken]);

  // 依目前空間的綁定狀態更新清單（只寫有變化的部分）。
  // 清單讀取失敗時仍可新增（setDoc merge 不需要先讀），但不刪除（不知道雲端現況）。
  const mine = findMyBinding(bindings, myLineKey);
  const myName = mine ? (roster.find((m) => m.id === mine.memberId)?.name ?? mine.binding.memberName) : null;
  useEffect(() => {
    if (!code || !key || !bindingsReady || (!loaded && !failed)) return;
    const store = useLineSpacesStore.getState();
    if (myName) {
      if (listed?.memberName === myName) return;
      if (!listed && listedCount >= MAX_LINE_SPACES) return;
      store.setEntry(code, myName);
      upsertLineSpace(key, code, myName).catch((error) => console.warn("更新 LINE 空間清單失敗：", error));
    } else if (listed && loaded) {
      store.removeEntry(code);
      removeLineSpace(key, code).catch((error) => console.warn("更新 LINE 空間清單失敗：", error));
    }
  }, [code, key, loaded, failed, bindingsReady, myName, listed, listedCount]);
}
