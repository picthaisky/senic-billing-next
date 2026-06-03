import { useSystemStore } from '../store/useSystemStore';

/**
 * Compatibility Facade for System State
 * 
 * This hook acts as an abstraction layer between UI components and the 
 * underlying state management (Zustand). This ensures that if the state
 * library changes in the future, consumers of this hook won't break.
 */
export function useAppSystem() {
  const isConnected = useSystemStore(state => state.isConnected);
  const status = useSystemStore(state => state.status);
  const components = useSystemStore(state => state.components);
  const lastChecked = useSystemStore(state => state.lastChecked);
  const onlineUsersCount = useSystemStore(state => state.onlineUsersCount);

  // Derived states for UI
  const isHealthy = status === 'Healthy';
  const hasIssues = status === 'Degraded' || status === 'Unhealthy';
  const isOffline = status === 'Offline' || !isConnected;

  return {
    isConnected,
    status,
    components,
    lastChecked,
    onlineUsersCount,
    
    // UI Helpers
    isHealthy,
    hasIssues,
    isOffline
  };
}
