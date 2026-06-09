'use client';
import { useState } from 'react';
import usePWA from '@/pwa/usePWA';

export default function DownloadCenter() {
  const { isInstallable, installApp, isInstalled } = usePWA();
  const [activeTab, setActiveTab] = useState('android'); // 'android' | 'ios' | 'desktop'

  return (
    <div className="min-h-screen bg-[var(--color-bg)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-10">
        
        {/* Title / Hero section */}
        <div className="text-center flex flex-col gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-4xl">
            Install PrashnaSārathi App
          </h1>
          <p className="max-w-xl mx-auto text-sm text-[var(--color-text-secondary)] leading-relaxed">
            Get the full native-like experience on your mobile device, tablet, or desktop computer. PrashnaSārathi is a Progressive Web App (PWA) that works beautifully everywhere.
          </p>
        </div>

        {/* Dynamic Action Card */}
        <div className="bg-gradient-to-tr from-[var(--color-primary)]/10 via-purple-500/5 to-transparent border border-[var(--color-border)] rounded-2xl p-8 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/10 rounded-full blur-3xl group-hover:scale-110 transition-all duration-500" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
                <span>⚡</span> Quick Install
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Install PrashnaSārathi directly on this device. Standalone window mode, offline database caching, and instant startup.
              </p>
            </div>
            <div className="shrink-0 w-full md:w-auto">
              {isInstalled ? (
                <div className="w-full text-center md:text-right">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                    ✓ Installed on this Device
                  </span>
                </div>
              ) : isInstallable ? (
                <button
                  onClick={installApp}
                  className="w-full md:w-auto px-6 py-3 text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 rounded-xl transition-all shadow-lg shadow-[var(--color-primary)]/20 hover:shadow-xl hover:shadow-[var(--color-primary)]/30 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Install App Now
                </button>
              ) : (
                <div className="w-full text-center md:text-right">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                    Supported in browser options
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Installation Instructions by Platform */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)]/80 rounded-2xl p-6 shadow-md">
          <h2 className="text-base font-bold text-[var(--color-text)] mb-4">Device Installation Guides</h2>
          
          {/* Tab buttons */}
          <div className="flex border-b border-[var(--color-border)] pb-px gap-1 mb-6">
            <button
              onClick={() => setActiveTab('android')}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'android'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <span>🤖</span> Android
            </button>
            <button
              onClick={() => setActiveTab('ios')}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'ios'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <span>🍏</span> iOS (iPhone/iPad)
            </button>
            <button
              onClick={() => setActiveTab('desktop')}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'desktop'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <span>💻</span> Desktop / PC
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                PrashnaSārathi installs instantly on Android devices using Chrome, Edge, or other Chromium-based mobile browsers.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    Open this website in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> on your Android phone.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    A banner should appear at the bottom saying <strong>"Add PrashnaSārathi to Home Screen"</strong>. Tap it.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    If no banner appears, tap the <strong>three dots (Menu)</strong> icon in the top right corner of Chrome, then select <strong>"Install app"</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ios' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                iOS uses Safari to install PWAs. The installation takes less than 15 seconds and doesn't require the App Store.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    Open this website in the <strong>Safari</strong> browser on your iPhone or iPad.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    Tap the <strong>Share</strong> button (the square icon with an arrow pointing up) in the bottom navigation bar.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    Scroll down the share sheet menu and tap <strong>"Add to Home Screen"</strong>, then confirm by tapping <strong>"Add"</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'desktop' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Run PrashnaSārathi in its own standalone window with shortcuts on your Desktop and Start Menu/Dock.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    Open this website in <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, or <strong>Brave</strong> on your PC, Mac, or Linux computer.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    Look at the right side of the address bar at the top of the browser. Click the <strong>"Install" icon</strong> (a screen with a down arrow, or overlapping squares).
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    Confirm by clicking <strong>"Install"</strong>. The app will open in a clean, native window and add an icon to your desktop.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Benefits Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]/50 rounded-2xl p-5 text-center">
            <span className="text-2xl block mb-2">⚡</span>
            <h3 className="text-xs font-bold text-[var(--color-text)] mb-1">Ultra-Lightweight</h3>
            <p className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed">Installs in seconds. Uses almost zero storage space compared to traditional native apps.</p>
          </div>
          <div className="bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]/50 rounded-2xl p-5 text-center">
            <span className="text-2xl block mb-2">🔄</span>
            <h3 className="text-xs font-bold text-[var(--color-text)] mb-1">Auto-Updates</h3>
            <p className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed">No manual updates required. The app stays updated with the latest fixes automatically on load.</p>
          </div>
          <div className="bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)]/50 rounded-2xl p-5 text-center">
            <span className="text-2xl block mb-2">🔔</span>
            <h3 className="text-xs font-bold text-[var(--color-text)] mb-1">Push Notifications</h3>
            <p className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed">Receive real-time alerts when your questions are answered, even when the app is closed.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
