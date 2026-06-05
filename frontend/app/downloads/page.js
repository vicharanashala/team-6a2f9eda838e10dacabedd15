'use client';
import { useState, useEffect } from 'react';
import usePWA from '@/pwa/usePWA';

export default function DownloadCenter() {
  const { isInstallable, installApp } = usePWA();
  const [versionInfo, setVersionInfo] = useState({
    latestVersion: '1.1.0',
    latestVersionCode: 2,
    changelog: 'Performance improvements, smoother client-side navigation transitions, and native deep linking support.',
    updateDate: 'June 5, 2026'
  });

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch('/api/app-version');
        if (response.ok) {
          const data = await response.json();
          setVersionInfo({
            latestVersion: data.latestVersion,
            latestVersionCode: data.latestVersionCode,
            changelog: data.changelog,
            updateDate: 'June 5, 2026' // Matches the date of today's release cycle
          });
        }
      } catch (err) {
        console.error('Failed to load version details:', err);
      }
    };
    fetchVersion();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto flex flex-col gap-10">
        
        {/* Title / Hero section */}
        <div className="text-center flex flex-col gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-4xl">
            Download PrashnaSārathi
          </h1>
          <p className="max-w-xl mx-auto text-sm text-[var(--color-text-secondary)] leading-relaxed">
            Access the community doubt-solving and FAQ portal from any device. Choose your platform below to get started.
          </p>
        </div>

        {/* Support Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* Web App Card */}
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text)]">Web App (PWA)</h2>
                  <p className="text-xs text-[var(--color-text-secondary)]">Instant browser app shell</p>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Add to your device home screen directly from your browser. Includes offline caching support and quick launching.
              </p>
            </div>
            <div className="mt-6">
              {isInstallable ? (
                <button
                  onClick={installApp}
                  className="w-full py-2.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Install Web App
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-2.5 text-xs font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  Installed / Supported natively
                </button>
              )}
            </div>
          </div>

          {/* Android APK Card */}
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl group-hover:bg-green-500/10 transition-all" />
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/10 text-green-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text)]">Android Application</h2>
                  <p className="text-xs text-[var(--color-text-secondary)]">APK Package Installer</p>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Native app built using Capacitor. Supports push notifications, deep links, image uploads, and system camera access.
              </p>
            </div>
            <div className="mt-6">
              <a
                href="/downloads/prashnasarathi-app.apk"
                download
                className="w-full py-2.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-xl transition-all shadow-md shadow-green-500/10 cursor-pointer flex items-center justify-center gap-1.5"
              >
                Download APK
              </a>
            </div>
          </div>

          {/* iOS Card */}
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925-3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 002.25 12c0 2.071 1.679 3.75 3.75 3.75h6z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text)]">iOS Application</h2>
                  <p className="text-xs text-[var(--color-text-secondary)]">Safari PWA Install</p>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Install directly on your iPhone or iPad without any third-party app stores or sideloading tools.
              </p>
            </div>
            <div className="mt-6 border border-dashed border-blue-500/30 rounded-xl p-3 bg-blue-500/5">
              <h3 className="text-xs font-semibold text-blue-400 mb-1">How to Install on iOS:</h3>
              <ol className="text-[10px] text-[var(--color-text-secondary)] list-decimal list-inside space-y-1">
                <li>Open this site in <strong>Safari</strong></li>
                <li>Tap the <strong>Share</strong> button (bottom bar)</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
              </ol>
            </div>
          </div>

          {/* Windows Card */}
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all" />
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text)]">Windows Application</h2>
                  <p className="text-xs text-[var(--color-text-secondary)]">Single Setup Installer (.exe)</p>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Native Windows client for laptop and desktop users. Download and run the single setup file to install the app and create shortcuts automatically.
              </p>
              
              <div className="mt-1 border border-amber-500/20 rounded-xl p-3 bg-amber-500/5 text-[10px] text-amber-400/90 leading-relaxed">
                <span className="font-semibold block mb-0.5">⚠️ Security Note:</span>
                Since this is a custom, unsigned application, Chrome may show an &quot;uncommon download&quot; or &quot;suspicious&quot; alert, and Windows SmartScreen might pop up. This is expected. Click <strong>Keep</strong> / <strong>More Info &gt; Run anyway</strong> to install safely.
              </div>
            </div>
            <div className="mt-6">
              <a
                href="/downloads/prashnasarathi-win.exe"
                download
                className="w-full py-2.5 text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-all shadow-md shadow-indigo-500/10 cursor-pointer flex items-center justify-center gap-1.5"
              >
                Download Setup Installer
              </a>
            </div>
          </div>

          {/* macOS Card */}
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-all" />
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925-3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 002.25 12c0 2.071 1.679 3.75 3.75 3.75h6z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text)]">macOS Application</h2>
                  <p className="text-xs text-[var(--color-text-secondary)]">Apple DMG Installer</p>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Native macOS client optimized for Apple Silicon (M1/M2/M3) and Intel devices with system notification support.
              </p>
            </div>
            <div className="mt-6">
              <a
                href="/downloads/prashnasarathi-mac.dmg"
                download
                className="w-full py-2.5 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-all shadow-md shadow-rose-500/10 cursor-pointer flex items-center justify-center gap-1.5"
              >
                Download for macOS
              </a>
            </div>
          </div>

        </div>

        {/* Release Notes section */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-md flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div>
              <h2 className="text-base font-bold text-[var(--color-text)]">Release Information</h2>
              <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mt-0.5">
                Version: {versionInfo.latestVersion} &bull; Build Code: {versionInfo.latestVersionCode}
              </p>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              Updated: {versionInfo.updateDate}
            </span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-[var(--color-text)] mb-1.5">What's New in this Release:</h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed font-normal">
              {versionInfo.changelog}
            </p>
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1 font-medium italic">
            Note: Non-PWA native installers must be installed manually. For Android, enable "Install from Unknown Sources" in settings if prompted.
          </div>
        </div>

      </div>
    </div>
  );
}
