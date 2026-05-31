import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Commuters',
  webDir: 'www',
  android: {
    allowMixedContent: true,
  },
  server: {
    allowNavigation: [
      '*.paymaya.com',
      '*.maya.ph',
      'pg-sandbox.paymaya.com',
      'payments.paymaya.com',
    ],
  },
  plugins: {
    // Match transit: native HTTP patching breaks Angular HttpClient + lazy chunks on Android.
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
