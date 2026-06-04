import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppLanguage = 'th' | 'en';

interface LocaleState {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      language: 'th',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'senic-locale-storage',
    }
  )
);
