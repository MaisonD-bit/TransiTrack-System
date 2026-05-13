import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  // Switched to localhost temporarily for debugging.
  apiUrl: 'http://localhost:8000/api/v1',

  mapbox: {
    accessToken: "pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA"
  },
  messaging: {
    streamApiKey: 'em2gqhhmgvng',
    streamApiSecret: '9qnnvs84t9anmvet63envwj46qc6yrp7kkg99adawv3sdrkhsshhnjc43ve6k9hu',
  }
};
