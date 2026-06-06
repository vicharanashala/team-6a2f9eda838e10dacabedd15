import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.prashnasarathi.app',
  appName: 'PrashnaSārathi',
  webDir: 'out',
  server: {
    url: 'https://prashnasarathi.vercel.app',
    cleartext: true,
    allowNavigation: [
      'prashnasarathi.vercel.app',
      '*.firebaseapp.com',
      'accounts.google.com',
      '*.google.com',
      '*.googleapis.com'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#0c0f17',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    App: {
      // Config for App listeners (Deep Links, Back Button etc.)
    }
  }
};

export default config;
