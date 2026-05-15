import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Commuters',
  webDir: 'www',
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'http',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
