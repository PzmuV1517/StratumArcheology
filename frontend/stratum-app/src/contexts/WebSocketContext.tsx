/**
 * @file
 * WebSocket context provider.
 *
 * Manages Socket.IO connection lifecycle and provides real-time
 * event subscription capabilities to child components.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
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

/**
 * Consumes the WebSocketContext to access the socket instance and project room helpers.
 * @returns The current WebSocket context value
 */
export const useWebSocket = () => useContext(WebSocketContext);

interface Props {
  children: React.ReactNode;
}

// Singleton socket instance to prevent connection spam
let globalSocket: Socket | null = null;
let connectionCount = 0;

/**
 * Manages a singleton Socket.IO connection and exposes it via React Context.
 * Connects when the user is authenticated and disconnects on logout.
 * @param props - Component props containing children to wrap
 * @returns A context provider wrapping children with WebSocket state
 */
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
