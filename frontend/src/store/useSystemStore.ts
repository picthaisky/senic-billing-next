import { create } from 'zustand';

export type SystemStatus = 'Healthy' | 'Degraded' | 'Unhealthy' | 'Unknown' | 'Offline';

export interface ComponentHealth {
  name: string;
  status: string;
  description?: string;
  duration: number;
}

interface SystemState {
  // SignalR Connection
  isConnected: boolean;
  
  // Health Checks
  status: SystemStatus;
  components: ComponentHealth[];
  lastChecked: Date | null;
  
  // Presence / Online Users
  onlineUsersCount: number;

  // Actions
  setConnectionStatus: (connected: boolean) => void;
  updateHealthStatus: (status: SystemStatus, components: ComponentHealth[]) => void;
  setOnlineUsersCount: (count: number) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  isConnected: false,
  status: 'Unknown',
  components: [],
  lastChecked: null,
  onlineUsersCount: 0,

  setConnectionStatus: (connected) => set({ 
    isConnected: connected,
    status: connected ? 'Healthy' : 'Offline'
  }),
  
  updateHealthStatus: (status, components) => set({ 
    status, 
    components,
    lastChecked: new Date()
  }),
  
  setOnlineUsersCount: (count) => set({ onlineUsersCount: count })
}));
