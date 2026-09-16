import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vyaparsamraj.app',
  appName: 'vyapar-samraj',
  webDir: 'out',
  server: {
    hostname: 'vyapar-samraj-frontend.onrender.com',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
};

export default config;
