import { create } from 'zustand';

interface AutoSaveStore {
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  setLastSaved: (date: Date) => void;
}

export const useAutoSaveStore = create<AutoSaveStore>((set) => ({
  isDirty: false,
  isSaving: false,
  lastSaved: null,
  setDirty: (dirty) => set({ isDirty: dirty }),
  setSaving: (saving) => set({ isSaving: saving }),
  setLastSaved: (date) => set({ lastSaved: date }),
}));

// Migration-related exports for compatibility
export const usePendingMigration = () => [];
export const useMigrationInProgress = () => false;
export const useAutoSaveActions = () => ({
  setMigrationInProgress: () => {},
  setPendingMigration: () => {},
  startMigration: () => {},
  dismissMigration: () => {},
  clearAnonymousData: () => {},
});