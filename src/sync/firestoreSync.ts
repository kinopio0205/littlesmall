import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useGroupStore } from '../store/groupStore';
import type { Group, GroupExpense, Settlement } from '../types';

interface LedgerDoc {
  groups: Group[];
  expenses: GroupExpense[];
  settlements: Settlement[];
}

function toLedgerDoc(state: LedgerDoc): LedgerDoc {
  return { groups: state.groups, expenses: state.expenses, settlements: state.settlements };
}

let unsubscribeSnapshot: (() => void) | null = null;
let unsubscribeStore: (() => void) | null = null;
let applyingRemote = false;
let currentCode: string | null = null;

export function connectSync(code: string, onReady?: () => void, onError?: (message: string) => void) {
  disconnectSync();
  currentCode = code;
  const ref = doc(db, 'ledgers', code);
  let firstSnapshot = true;

  unsubscribeSnapshot = onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as LedgerDoc;
        applyingRemote = true;
        useGroupStore.setState({
          groups: data.groups ?? [],
          expenses: data.expenses ?? [],
          settlements: data.settlements ?? [],
        });
        applyingRemote = false;
      } else {
        setDoc(ref, toLedgerDoc(useGroupStore.getState()));
      }
      if (firstSnapshot) {
        firstSnapshot = false;
        onReady?.();
      }
    },
    (error) => {
      console.error('Firestore sync error:', error);
      onError?.(error.message);
    },
  );

  unsubscribeStore = useGroupStore.subscribe((state) => {
    if (applyingRemote || !currentCode) return;
    setDoc(doc(db, 'ledgers', currentCode), toLedgerDoc(state));
  });
}

export function disconnectSync() {
  unsubscribeSnapshot?.();
  unsubscribeStore?.();
  unsubscribeSnapshot = null;
  unsubscribeStore = null;
  currentCode = null;
  useGroupStore.setState({ groups: [], expenses: [], settlements: [] });
}
