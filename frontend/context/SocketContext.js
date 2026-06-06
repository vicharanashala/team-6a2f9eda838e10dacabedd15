'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = typeof window !== 'undefined'
  ? ''
  : (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000');

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

    const token = localStorage.getItem('token');
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    let errorCount = 0;
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      errorCount = 0;
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      errorCount++;
      if (errorCount >= 3) {
        console.warn('[Socket] Socket server not available on this host. Disabling socket client to prevent console spam.');
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
