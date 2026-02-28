// src/store.ts
// In-memory state management (ไม่ใช้ localStorage สำหรับ sensitive data)

import type {
  LiffProfile, User, PdpaStatus, Event, Registration,
  RouteState, AdminSession
} from './types';

interface AppState {
  // Auth
  liffProfile:  LiffProfile | null;
  user:         User | null;
  pdpaStatus:   PdpaStatus | null;
  lineToken:    string | null;        // idToken จาก LIFF (in-memory only)

  // Navigation
  currentRoute: RouteState;
  history:      RouteState[];

  // Data cache (in-memory)
  events:       Event[];
  myRegistrations: Registration[];

  // Admin
  adminSession: AdminSession | null;

  // UI
  isLoading:    boolean;
  loadingText:  string;
}

const initialState: AppState = {
  liffProfile:     null,
  user:            null,
  pdpaStatus:      null,
  lineToken:       null,
  currentRoute:    { name: 'loading', params: {} },
  history:         [],
  events:          [],
  myRegistrations: [],
  adminSession:    null,
  isLoading:       false,
  loadingText:     'กำลังโหลด...'
};

// Reactive store (observer pattern เบาๆ)
type Listener = (state: AppState) => void;
const listeners = new Set<Listener>();

let state: AppState = { ...initialState };

export const Store = {
  getState: (): Readonly<AppState> => state,

  setState(partial: Partial<AppState>): void {
    state = { ...state, ...partial };
    listeners.forEach(fn => fn(state));
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // Helpers
  setRoute(name: RouteState['name'], params: Record<string, string> = {}): void {
    const prev = state.currentRoute;
    this.setState({
      currentRoute: { name, params },
      history: [...state.history, prev].slice(-10) // keep last 10
    });
  },

  goBack(): void {
    const hist = [...state.history];
    const prev = hist.pop();
    if (prev) {
      this.setState({ currentRoute: prev, history: hist });
    }
  },

  getAdminSession(): AdminSession | null {
    if (state.adminSession) return state.adminSession;
    // Try sessionStorage (ไม่ sensitive เพราะ token ใช้ session เท่านั้น)
    try {
      const raw = sessionStorage.getItem('runner_admin');
      if (raw) {
        const session = JSON.parse(raw) as AdminSession;
        this.setState({ adminSession: session });
        return session;
      }
    } catch {}
    return null;
  },

  setAdminSession(session: AdminSession | null): void {
    this.setState({ adminSession: session });
    try {
      if (session) sessionStorage.setItem('runner_admin', JSON.stringify(session));
      else sessionStorage.removeItem('runner_admin');
    } catch {}
  },

  reset(): void {
    state = { ...initialState };
    listeners.forEach(fn => fn(state));
  }
};
