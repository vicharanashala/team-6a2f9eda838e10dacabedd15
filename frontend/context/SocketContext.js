'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const getSocketUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
  }

  const origin = window.location.origin;

  // Native app wrappers — always point to the Vercel backend path
  if (origin.startsWith('tauri://') || origin.startsWith('file:') || origin.startsWith('capacitor://')) {
    return 'https://prashnasarathi.vercel.app/_/backend';
  }

  // For web (Vercel hosted), use the backend sub-path via same origin
  // This avoids cross-origin issues and uses Vercel's internal routing
  if (process.env.NEXT_PUBLIC_SOCKET_URL && !process.env.NEXT_PUBLIC_SOCKET_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  // On production Vercel: backend is at /_/backend
  if (origin.includes('vercel.app') || origin.includes('prashnasarathi')) {
    return `${origin}/_/backend`;
  }

  // Local development — socket server runs separately on port 5000
  return 'http://localhost:5000';
};

const SOCKET_URL = getSocketUrl();

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    console.log('[Socket] Connecting to:', SOCKET_URL);
    const token = localStorage.getItem('token');
    
    // On Vercel, the socket path must include the /_/backend prefix
    const isVercel = SOCKET_URL.includes('/_/backend');
    const socketPath = isVercel ? '/_/backend/socket.io' : '/socket.io';
    
    const newSocket = io(SOCKET_URL.replace('/_/backend', ''), {
      auth: { token },
      path: socketPath,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      timeout: 10000,
    });

    let errorCount = 0;
    newSocket.on('connect', () => {
      console.log('[Socket] Connected successfully:', newSocket.id);
      errorCount = 0;
    });

    newSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      errorCount++;
      if (errorCount >= 5) {
        console.warn('[Socket] Socket server not available. Web Push will handle background notifications.');
        newSocket.disconnect();
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
