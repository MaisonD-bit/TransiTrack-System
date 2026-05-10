export const environment = {
  production: true,
  /** Set to your deployed API or current ngrok URL; rebuild after changing. */
  apiUrl: 'https://semitextural-hyun-overpolemically.ngrok-free.dev/api/v1',
  ocrApiKey: 'K87693276688957',
  mapbox: {
    accessToken: ''
  },
  payment: {
    paymango: {
      publicKey: 'pk_test_m1kdK8iC26wkPEBdGTgHjGJZ',
      // Note: Secret key should be handled server-side only
      baseUrl: 'https://pg.paymango.com' // Production URL
    }
  }
};