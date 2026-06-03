import * as signalR from '@microsoft/signalr';
import { useSystemStore } from '../store/useSystemStore';
import { useAuthStore } from '../store/useAuthStore';

class SignalRClient {
  private connection: signalR.HubConnection | null = null;
  private isConnecting = false;

  public async connect() {
    if (this.connection?.state === signalR.HubConnectionState.Connected || this.isConnecting) {
      return;
    }

    const token = useAuthStore.getState().token;
    if (!token) return; // Cannot connect without token

    this.isConnecting = true;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/hubs/billing`, {
        accessTokenFactory: () => token,
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000]) // Retry intervals
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Setup event listeners
    this.connection.on('ReceiveSystemStatus', (data) => {
      useSystemStore.getState().updateHealthStatus(data.status, data.components);
    });

    this.connection.on('UserPresenceChanged', (userId: string, isOnline: boolean) => {
      // Basic presence count logic
      const state = useSystemStore.getState();
      const newCount = isOnline ? state.onlineUsersCount + 1 : Math.max(0, state.onlineUsersCount - 1);
      state.setOnlineUsersCount(newCount);
    });

    // Connection lifecycle
    this.connection.onreconnecting(() => {
      useSystemStore.getState().setConnectionStatus(false);
    });

    this.connection.onreconnected(() => {
      useSystemStore.getState().setConnectionStatus(true);
    });

    this.connection.onclose(() => {
      useSystemStore.getState().setConnectionStatus(false);
      this.connection = null;
    });

    try {
      await this.connection.start();
      useSystemStore.getState().setConnectionStatus(true);
      console.log('SignalR connected.');
    } catch (err) {
      console.error('SignalR connection error:', err);
      useSystemStore.getState().setConnectionStatus(false);
    } finally {
      this.isConnecting = false;
    }
  }

  public async disconnect() {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }
}

export const signalRClient = new SignalRClient();
