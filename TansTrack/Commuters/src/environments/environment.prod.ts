export const environment = {
  production: true,
  /** Set to your deployed API or current ngrok URL; rebuild after changing. */
  apiUrl: 'https://5b6f-113-19-183-130.ngrok-free.app/api/v1',
  ocrApiKey: 'K87693276688957',
  mapbox: {
    accessToken: 'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA'
  },
  payment: {
    paymango: {
      publicKey: 'pk-pk_test_m1kdK8iC26wkPEBdGTgHjGJZ',
      // Note: Secret key should be handled server-side only
      baseUrl: 'https://pg.paymango.com' // Production URL
    }
  }
};