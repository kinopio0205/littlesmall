import { useEffect, useState } from 'react';

const SKIP_AFTER_MS = 5000;

/** LINE（LIFF）初始化期間的畫面；太久時讓使用者略過，改用一般方式進入。 */
export default function LiffConnecting({ onSkip }: { onSkip: () => void }) {
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSkip(true), SKIP_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-slate-500 text-sm mb-3">LINE 連線中…</div>
        {showSkip && (
          <button
            onClick={onSkip}
            className="text-xs text-slate-500 border border-slate-700 rounded-full px-3 py-1.5 hover:text-cyan-300 hover:border-cyan-400/30"
          >
            略過，手動進入
          </button>
        )}
      </div>
    </div>
  );
}
