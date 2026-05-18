import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  apiUrl: 'https://exodus-jury-unripe.ngrok-free.dev/api/v1',
  // apiUrl: 'https://exodus-jury-unripe.ngrok-free.dev/api/v1',
  mapbox: {
    accessToken: "pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA"
  },
  messaging: {
    streamApiKey: 'em2gqhhmgvng',
  }
};
