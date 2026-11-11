import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * 「這個 LINE 帳號參與的分帳空間」雲端清單：lineSpaces/{SHA-256("line-spaces:" + userId)}
 * = { spaces: { [同步碼]: { memberName, updatedAt } }, v: 1 }。
 * 讓同一個 LINE 帳號在任何裝置都能列出自己的空間。只存 userId 的雜湊；
 * LINE userId 只有這個 app（同一個 Provider）拿得到，外人無法算出文件 id。
 */
export interface LineSpaceEntry {
  memberName: string;
  updatedAt: string;
}

export type LineSpaceMap = Record<string, LineSpaceEntry>;

export async function computeUserSpacesKey(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`line-spaces:${userId}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const spacesRef = (key: string) => doc(db, 'lineSpaces', key);

function isEntry(value: unknown): value is LineSpaceEntry {
  const v = value as Partial<LineSpaceEntry> | null;
  return !!v && typeof v.memberName === 'string';
}

export async function loadLineSpaces(key: string): Promise<LineSpaceMap> {
  const snap = await getDoc(spacesRef(key));
  const raw = snap.exists() ? (snap.data().spaces as Record<string, unknown> | undefined) : undefined;
  const spaces: LineSpaceMap = {};
  for (const [code, entry] of Object.entries(raw ?? {})) {
    if (isEntry(entry)) spaces[code] = entry;
  }
  return spaces;
}

/** 新增或更新一個空間（欄位層級合併：不同裝置同時新增不同空間不會互相覆寫）。 */
export async function upsertLineSpace(key: string, code: string, memberName: string) {
  const entry: LineSpaceEntry = { memberName: memberName.slice(0, 50), updatedAt: new Date().toISOString() };
  await setDoc(spacesRef(key), { spaces: { [code]: entry }, v: 1 }, { merge: true });
}

/** 從清單移除一個空間；清單不存在時不做事。 */
export async function removeLineSpace(key: string, code: string) {
  try {
    await updateDoc(spacesRef(key), { [`spaces.${code}`]: deleteField() });
  } catch (error) {
    if ((error as { code?: string }).code === 'not-found') return;
    throw error;
  }
}
