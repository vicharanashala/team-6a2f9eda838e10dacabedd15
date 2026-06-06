const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1020,
    height: 768,
    title: "PrashnaSārathi",
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });

  // Load the production web application
  mainWindow.loadURL('https://prashnasarathi.vercel.app');

  // Open external links in system browser, allow oauth popups inside electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isOAuth = url.includes('firebaseapp.com') || 
                    url.includes('google.com') || 
                    url.includes('googleapis.com') || 
                    url.includes('prashnasarathi.vercel.app');
    if (isOAuth) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  // Set User-Agent globally to standard Chrome to bypass Google OAuth disallowed webview restrictions
  session.defaultSession.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
