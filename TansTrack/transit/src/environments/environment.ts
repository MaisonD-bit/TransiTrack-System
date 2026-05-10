import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  /** Same Laravel as `ngrok http 8000` — use localhost in the browser to avoid ngrok CORS/interstitial. */
  apiUrl: 'http://localhost:8000/api/v1',
  mapbox: {
    accessToken: ''
  }
};
