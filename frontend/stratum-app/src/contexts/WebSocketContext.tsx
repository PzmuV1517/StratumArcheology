/**
 * WebSocket context for real-time project updates
 * Handles member kicks, role changes, and other real-time events
 *
 * Uses a singleton socket that persists across route changes
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { io, Socket } from "socket.io-client";
import { config } from "../config/config";
import { useAuth } from "./AuthContext";

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinProject: (projectId: string, userId: string) => void;
  leaveProject: (projectId: string, userId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  joinProject: () => {},
  leaveProject: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

interface Props {
  children: React.ReactNode;
}

// Singleton socket instance to prevent connection spam
let globalSocket: Socket | null = null;
let connectionCount = 0;

export const WebSocketProvider: React.FC<Props> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const isConnectingRef = useRef(false);

  useEffect(() => {
    // Only connect when user is authenticated
    if (!user) {
      // Disconnect if user logs out
      if (globalSocket) {
        if (__DEV__) console.log("[WebSocket] User logged out, disconnecting");
        globalSocket.close();
        globalSocket = null;
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Reuse existing connection
    if (globalSocket && globalSocket.connected) {
      // Only log in development
      if (__DEV__) console.log("[WebSocket] Reusing existing connection");
      socketRef.current = globalSocket;
      setSocket(globalSocket);
      setIsConnected(true);
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;
    connectionCount++;
    const currentCount = connectionCount;

    // Extract base URL and construct WebSocket URL
    // The backend mounts Socket.IO at /ws with its own /socket.io path
    const baseUrl = config.apiBaseUrl.replace("/api", "");

    if (__DEV__)
      console.log(
        "[WebSocket] Connecting to:",
        baseUrl,
        `(attempt ${currentCount})`,
      );

    // Create Socket.IO connection
    // Backend mounts Socket.IO at /ws with empty socketio_path
    const newSocket = io(baseUrl, {
      path: "/ws",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 3,
      autoConnect: true,
      timeout: 10000,
    });

    newSocket.on("connect", () => {
      if (__DEV__) console.log("[WebSocket] Connected:", newSocket.id);
      setIsConnected(true);
      isConnectingRef.current = false;
    });

    newSocket.on("disconnect", (reason) => {
      if (__DEV__) console.log("[WebSocket] Disconnected:", reason);
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      // Only log in development to reduce console noise
      if (__DEV__) console.warn("[WebSocket] Connection error:", error.message);
      setIsConnected(false);
      isConnectingRef.current = false;
    });

    globalSocket = newSocket;
    socketRef.current = newSocket;
    setSocket(newSocket);

    // Cleanup only when component unmounts AND user is gone
    return () => {
      // Don't disconnect on every re-render, keep the singleton alive
      // Only disconnect if explicitly logging out (handled in user effect)
    };
  }, [user]);

  const joinProject = useCallback((projectId: string, userId: string) => {
    if (socketRef.current?.connected) {
      if (__DEV__) console.log("[WebSocket] Joining project:", projectId);
      socketRef.current.emit("join_project", {
        project_id: projectId,
        user_id: userId,
      });
    }
  }, []);

  const leaveProject = useCallback((projectId: string, userId: string) => {
    if (socketRef.current?.connected) {
      if (__DEV__) console.log("[WebSocket] Leaving project:", projectId);
      socketRef.current.emit("leave_project", {
        project_id: projectId,
        user_id: userId,
      });
    }
  }, []);

  return (
    <WebSocketContext.Provider
      value={{ socket, isConnected, joinProject, leaveProject }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};
