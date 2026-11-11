import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

// 本機開發可設 VITE_FIRESTORE_EMULATOR=127.0.0.1:8085 改連 Firestore Emulator，不碰正式資料。
// 只在 dev server 生效；正式 build 時整段會被移除。
const emulatorHost = import.meta.env.DEV ? import.meta.env.VITE_FIRESTORE_EMULATOR : undefined;
if (emulatorHost) {
  const [host, port] = emulatorHost.split(':');
  connectFirestoreEmulator(db, host, Number(port));
}
