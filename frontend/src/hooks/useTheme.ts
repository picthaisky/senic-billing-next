import { useCallback, useEffect, useState } from 'react';

export type ThemeName = 'warm-horizon' | 'deep-ocean';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const stored = localStorage.getItem('senic-theme');
    return (stored as ThemeName) || 'warm-horizon';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('senic-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'warm-horizon' ? 'deep-ocean' : 'warm-horizon'));
  }, []);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
  }, []);

  return { theme, toggleTheme, setTheme };
}
