export const environment = {
  production: false,
  // Must match the https URL in `ngrok` “Forwarding” (free tier changes when you restart ngrok).
  apiUrl: 'https://4740-113-19-183-82.ngrok-free.app/api/v1',
  // apiUrl: 'http://192.168.1.2:8000/api/v1', // Use local IP only if on same WiFi
  ocrApiKey: 'K87693276688957',

  messaging: {  
     streamApiKey: 'em2gqhhmgvng',
  streamApiSecret: '9qnnvs84t9anmvet63envwj46qc6yrp7kkg99adawv3sdrkhsshhnjc43ve6k9hu',

  },
 
  mapbox: {
    accessToken: 'mapboxToken'
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
