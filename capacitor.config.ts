import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vyaparsamraj.app',
  appName: 'vyapar-samraj',
  webDir: 'public',
  server: {
    url: 'http://192.168.55.103:3000',
    cleartext: true,
  },
};

export default config;
