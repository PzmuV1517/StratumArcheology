/**
 * @file
 * Socket.IO client service for real-time communication.
 *
 * Manages WebSocket connections to the backend for receiving
 * real-time project updates, member changes, and content notifications.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { config } from "../config/config";
import AsyncStorage from "@react-native-async-storage/async-storage";

type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;

interface SocketServiceState {
  socket: WebSocket | null;
  connected: boolean;
  projectId: string | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  messageHandlers: Map<string, Set<MessageHandler>>;
  onConnectHandlers: Set<ConnectionHandler>;
  onDisconnectHandlers: Set<ConnectionHandler>;
}

const state: SocketServiceState = {
  socket: null,
  connected: false,
  projectId: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  messageHandlers: new Map(),
  onConnectHandlers: new Set(),
  onDisconnectHandlers: new Set(),
};

/**
 * Build WebSocket URL from API base URL
 */
const getWsUrl = async (): Promise<string> => {
  let baseUrl = config.apiBaseUrl;

  // Check for override
  try {
    const override = await AsyncStorage.getItem("apiBaseUrlOverride");
    if (override) baseUrl = override;
  } catch {}

  // Convert HTTP to WS
  return baseUrl.replace(/^http/, "ws");
};

/**
 * WebSocket service for real-time updates
 * Works on both web and native platforms using native WebSocket API
 */
export const socketService = {
  /**
   * Connect to project WebSocket
   */
  connect: async (projectId: string): Promise<void> => {
    // Disconnect existing connection
    if (state.socket) {
      socketService.disconnect();
    }

    state.projectId = projectId;
    state.reconnectAttempts = 0;

    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        console.warn("No auth token available for WebSocket connection");
        return;
      }

      const wsBaseUrl = await getWsUrl();
      const wsUrl = `${wsBaseUrl}/ws/project/${projectId}?token=${encodeURIComponent(token)}`;

      state.socket = new WebSocket(wsUrl);

      state.socket.onopen = () => {
        console.log(`WebSocket connected to project ${projectId}`);
        state.connected = true;
        state.reconnectAttempts = 0;

        // Notify connect handlers
        state.onConnectHandlers.forEach((handler) => {
          try {
            handler();
          } catch (e) {
            console.error("Connect handler error:", e);
          }
        });
      };

      state.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const eventType = data.type || data.event || "message";

          // Dispatch to handlers for this event type
          const handlers = state.messageHandlers.get(eventType);
          if (handlers) {
            handlers.forEach((handler) => {
              try {
                handler(data);
              } catch (e) {
                console.error(`Handler error for event ${eventType}:`, e);
              }
            });
          }

          // Also dispatch to 'all' handlers
          const allHandlers = state.messageHandlers.get("*");
          if (allHandlers) {
            allHandlers.forEach((handler) => {
              try {
                handler(data);
              } catch (e) {
                console.error("Wildcard handler error:", e);
              }
            });
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      state.socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      state.socket.onclose = (event) => {
        console.log(`WebSocket closed: code=${event.code}, reason=${event.reason}`);
        state.connected = false;
        state.socket = null;

        // Notify disconnect handlers
        state.onDisconnectHandlers.forEach((handler) => {
          try {
            handler();
          } catch (e) {
            console.error("Disconnect handler error:", e);
          }
        });

        // Attempt reconnection if not intentional close
        if (
          event.code !== 1000 &&
          state.projectId !== null &&
          state.reconnectAttempts < state.maxReconnectAttempts
        ) {
          state.reconnectAttempts++;
          const delay =
            state.reconnectDelay * Math.pow(2, state.reconnectAttempts - 1);
          console.log(
            `Reconnecting in ${delay}ms (attempt ${state.reconnectAttempts})`,
          );

          setTimeout(() => {
            if (state.projectId !== null) {
              socketService.connect(state.projectId);
            }
          }, delay);
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  },

  /**
   * Disconnect WebSocket
   */
  disconnect: (): void => {
    if (state.socket) {
      state.socket.close(1000, "Client disconnect");
      state.socket = null;
    }
    state.connected = false;
    state.projectId = null;
    state.reconnectAttempts = 0;
  },

  /**
   * Subscribe to a specific event type
   */
  on: (eventType: string, handler: MessageHandler): (() => void) => {
    if (!state.messageHandlers.has(eventType)) {
      state.messageHandlers.set(eventType, new Set());
    }
    state.messageHandlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = state.messageHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  },

  /**
   * Subscribe to all events
   */
  onAny: (handler: MessageHandler): (() => void) => {
    return socketService.on("*", handler);
  },

  /**
   * Subscribe to connection event
   */
  onConnect: (handler: ConnectionHandler): (() => void) => {
    state.onConnectHandlers.add(handler);
    return () => {
      state.onConnectHandlers.delete(handler);
    };
  },

  /**
   * Subscribe to disconnection event
   */
  onDisconnect: (handler: ConnectionHandler): (() => void) => {
    state.onDisconnectHandlers.add(handler);
    return () => {
      state.onDisconnectHandlers.delete(handler);
    };
  },

  /**
   * Send a message through WebSocket
   */
  send: (data: any): void => {
    if (state.socket && state.connected) {
      state.socket.send(JSON.stringify(data));
    } else {
      console.warn("Cannot send: WebSocket not connected");
    }
  },

  /**
   * Check if currently connected
   */
  isConnected: (): boolean => {
    return state.connected;
  },

  /**
   * Get current project ID
   */
  getProjectId: (): string | null => {
    return state.projectId;
  },
};
