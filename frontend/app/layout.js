import '@/styles/globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { KeyboardProvider } from '@/context/KeyboardContext';
import { ThemeProvider } from '@/context/ThemeContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'PrashnaSārathi - Community Q&A and FAQ Platform',
  description: 'A community-driven Q&A and FAQ platform for knowledge sharing',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col font-mono">
        <AuthProvider>
          <SocketProvider>
            <KeyboardProvider>
              <ThemeProvider>
                <Navbar />
                <main className="flex-1">
                  {children}
                </main>
                <Footer />
                <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
              </ThemeProvider>
            </KeyboardProvider>
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
