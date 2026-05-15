import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'transitrack',
  webDir: 'www',
  android: {
    allowMixedContent: true,
  },
  plugins: {
    // Leave native fetch/XHR alone — patching can break Angular + lazy chunks on Android.
    CapacitorHttp: {
      enabled: false,
    },
    Geolocation: {
      // Required for Fake GPS / mock location apps on Android
    },
  },
};

export default config;
