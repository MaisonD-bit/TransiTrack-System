export const environment = {
  production: false,
  /**
   * Local Laravel (`php artisan serve` → :8000). Ionic (`ionic serve` → :8100) calls this URL cross-origin;
   * BusOperator `config/cors.php` allows it — no ngrok/CORS interstitial issues.
   *
   * Free ngrok URLs change every restart; the bundled app only picks up a new URL after you edit this
   * value and rebuild/restart `ionic serve`. For phone/LAN testing use your LAN IP, e.g.
   * `http://192.168.x.x:8000/api/v1`. To hit the tunnel from a device, paste the current Forwarding URL:
   * `https://xxxx.ngrok-free.app/api/v1` (expect ngrok browser-warning quirks on OPTIONS unless using a paid/reserved domain).
   */
  apiUrl: 'https://exodus-jury-unripe.ngrok-free.dev/api/v1',
  ocrApiKey: 'K87693276688957',

  mapbox: {
    accessToken: 'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA'
  },

  /** Matches terminal manager / approved route packages (north | south) */
  commuterTerminal: 'north' as 'north' | 'south',
  commuterBusTypeDefault: 'regular' as 'regular' | 'aircon',
  
  payment: {
    stripe: {
      publicKey: 'pk_test_51TVByVJ12vxXiUyWP32KQQEPwMnNs5W8HbmFgFAYjWrwR8vHWbDZWFTCW4ELCGANS6TI8a7V8R2jN5tofgeaCes900b2azGweU',
    }
  }

};
