import { useState } from 'react';
import { usePersonalStore } from '../store/personalStore';
import Modal from '../components/Modal';
import type { Category, TxType } from '../types';

const EMOJI_OPTIONS = [
  '🍚', '🚗', '🛍️', '🎮', '🏠', '💊', '📚', '📦', '💰', '🎁', '📈', '🧾',
  '☕', '🍺', '✈️', '🎬', '🐾', '👕', '📱', '💡', '🎓', '🏥', '🎵', '⚽',
];

export default function Categories() {
  const categories = usePersonalStore((s) => s.categories);
  const addCategory = usePersonalStore((s) => s.addCategory);
  const updateCategory = usePersonalStore((s) => s.updateCategory);
  const deleteCategory = usePersonalStore((s) => s.deleteCategory);

  const [modalType, setModalType] = useState<TxType | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(EMOJI_OPTIONS[0]);

  function openAdd(type: TxType) {
    setEditing(null);
    setName('');
    setIcon(EMOJI_OPTIONS[0]);
    setModalType(type);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setName(cat.name);
    setIcon(cat.icon);
    setModalType(cat.type);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (editing) {
      updateCategory(editing.id, name.trim(), icon);
    } else if (modalType) {
      addCategory(name.trim(), icon, modalType);
    }
    setModalType(null);
  }

  function renderList(type: TxType, label: string) {
    const list = categories.filter((c) => c.type === type);
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium text-gray-800">{label}</div>
          <button onClick={() => openAdd(type)} className="text-xs text-indigo-500">
            + 新增分類
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => openEdit(c)}
              className="flex flex-col items-center gap-1 py-3 rounded-lg border border-gray-100 hover:border-indigo-300 text-xs text-gray-600"
            >
              <span className="text-xl">{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-800">分類管理</h1>
      {renderList('expense', '支出分類')}
      {renderList('income', '收入分類')}

      {modalType && (
        <Modal title={editing ? '編輯分類' : '新增分類'} onClose={() => setModalType(null)}>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">名稱</label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">圖示</label>
              <div className="grid grid-cols-8 gap-2">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setIcon(e)}
                    className={`text-lg py-1.5 rounded-lg border ${icon === e ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('刪除此分類？已使用此分類的記錄會顯示為未分類。')) {
                      deleteCategory(editing.id);
                      setModalType(null);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-lg border border-rose-200 text-rose-500 text-sm font-medium hover:bg-rose-50"
                >
                  刪除
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
              >
                儲存
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
