// app/layout.js (Server Component)
import '@/styles/globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { KeyboardProvider } from '@/context/KeyboardContext';
import { VoiceCommandProvider } from '@/context/VoiceCommandContext';
import { ThemeProvider } from '@/context/ThemeContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Toaster } from 'react-hot-toast';
import PwaProvider from '@/pwa/PwaProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import VoiceSearchWrapper from '@/components/VoiceSearchWrapper';
import ReportIssueButton from '@/components/ReportIssueButton';


export const metadata = {
  title: 'PrashnaSārathi - Community Q&A and FAQ Platform',
  description: 'A community-driven Q&A and FAQ platform for knowledge sharing',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="shortcut" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col font-sans relative">
        <AuthProvider>
          <SocketProvider>
            <NotificationProvider>
              <VoiceCommandProvider>
                <KeyboardProvider>
                  <ThemeProvider>
                    <PwaProvider>
                      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
                      <Navbar />
                      <main className="flex-1">
                        <ErrorBoundary>{children}</ErrorBoundary>
                      </main>
                      <Footer />
                      <VoiceSearchWrapper />
                      <ReportIssueButton />
                    </PwaProvider>
                  </ThemeProvider>
                </KeyboardProvider>
              </VoiceCommandProvider>
            </NotificationProvider>
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
