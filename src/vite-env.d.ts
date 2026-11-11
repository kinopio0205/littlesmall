/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** LINE MINI App 的 LIFF ID（公開值）。開發版用 Developing，正式版由部署時注入 Published。 */
  readonly VITE_LIFF_ID?: string;
  /** 本機開發時改連 Firestore Emulator，例如 127.0.0.1:8085。 */
  readonly VITE_FIRESTORE_EMULATOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
