import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  /** Same Laravel as `ngrok http 8000` — use localhost in the browser to avoid ngrok CORS/interstitial. */
  apiUrl: 'http://localhost:8000/api',
  mapbox: {
    accessToken: "pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA"
  }
};
