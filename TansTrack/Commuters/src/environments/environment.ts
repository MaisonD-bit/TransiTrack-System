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
  apiUrl: 'https://5b6f-113-19-183-130.ngrok-free.app/api/v1',
  ocrApiKey: 'K87693276688957',

  messaging: {  
     streamApiKey: 'em2gqhhmgvng',
  streamApiSecret: '9qnnvs84t9anmvet63envwj46qc6yrp7kkg99adawv3sdrkhsshhnjc43ve6k9hu',

  },
 
  mapbox: {
    accessToken: 'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA'
  },

  /** Matches terminal manager / approved route packages (north | south) */
  commuterTerminal: 'north' as 'north' | 'south',
  commuterBusTypeDefault: 'regular' as 'regular' | 'aircon',
  
  payment: {
    paymango: {
      publicKey: 'pk_test_m1kdK8iC26wkPEBdGTgHjGJZ',
      // Note: Secret key should be handled server-side only
      baseUrl: 'https://pg-sandbox.paymango.com' // Sandbox for testing
    }
  }

};
