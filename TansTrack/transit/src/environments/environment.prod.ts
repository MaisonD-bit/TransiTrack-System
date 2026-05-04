import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  /** Update when tunnel/domain changes; rebuild required. */
  apiUrl: 'https://187b-113-19-183-82.ngrok-free.app/api',
  mapbox: {
    accessToken: "pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA"
  }
};
