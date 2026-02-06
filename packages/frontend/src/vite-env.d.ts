/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POKER_CONTRACT_ADDRESS: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_COORDINATOR_WS_URL: string;
  readonly VITE_CHAIN_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
