import { initializeApp } from 'firebase/app';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Vite 환경 변수를 사용합니다. VITE_ 접두사가 붙은 값은 클라이언트에서 접근 가능합니다.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'unlock-system-f31d9',
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

export function useEmulatorIfLocal() {
  const host = import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST || '127.0.0.1';
  const port = Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || '5001');
  if (location.hostname === 'localhost') {
    connectFunctionsEmulator(functions, host, port);
  }
}

export { functions };
