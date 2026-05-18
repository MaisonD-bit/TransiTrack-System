export const environment = {
  production: true,
  /**
   * Android / Capacitor (ionic build) — pick ONE, then rebuild:
   * A) Same Wi‑Fi: PC LAN IP (`ipconfig`) + php artisan serve --host=0.0.0.0 --port=8000
   * B) ngrok: `ngrok http 8000` (not 800), paste Forwarding URL below
   * C) Emulator: http://10.0.2.2:8000/api/v1
   */
  apiUrl: 'http://192.168.43.21:8000/api/v1',
  // apiUrl: 'https://exodus-jury-unripe.ngrok-free.dev/api/v1',

  ocrApiKey: 'K87693276688957',

  mapbox: {
    accessToken: 'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA'
  },

  commuterTerminal: 'north' as 'north' | 'south',
  commuterBusTypeDefault: 'regular' as 'regular' | 'aircon',

  payment: {
    stripe: {
      publicKey: 'pk_test_51TVByVJ12vxXiUyWP32KQQEPwMnNs5W8HbmFgFAYjWrwR8vHWbDZWFTCW4ELCGANS6TI8a7V8R2jN5tofgeaCes900b2azGweU',
    }
  }
};
