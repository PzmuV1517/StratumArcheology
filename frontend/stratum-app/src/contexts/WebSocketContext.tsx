/**
 * WebSocket context for real-time project updates
 * Handles member kicks, role changes, and other real-time events
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { config } from '../config/config';

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

export const WebSocketProvider: React.FC<Props> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Extract base URL and construct WebSocket URL
    const baseUrl = config.apiBaseUrl.replace('/api', '');
    const wsUrl = `${baseUrl}/ws`;

    console.log('[WebSocket] Connecting to:', wsUrl);

    // Create Socket.IO connection
    const newSocket = io(wsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      console.log('[WebSocket] Connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      setIsConnected(false);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log('[WebSocket] Cleaning up connection');
      newSocket.close();
    };
  }, []);

  const joinProject = (projectId: string, userId: string) => {
    if (socketRef.current?.connected) {
      console.log('[WebSocket] Joining project:', projectId);
      socketRef.current.emit('join_project', { project_id: projectId, user_id: userId });
    } else {
      console.warn('[WebSocket] Cannot join project - not connected');
    }
  };

  const leaveProject = (projectId: string, userId: string) => {
    if (socketRef.current?.connected) {
      console.log('[WebSocket] Leaving project:', projectId);
      socketRef.current.emit('leave_project', { project_id: projectId, user_id: userId });
    }
  };

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, joinProject, leaveProject }}>
      {children}
    </WebSocketContext.Provider>
  );
};
