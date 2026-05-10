import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  /** Update when tunnel/domain changes; rebuild required. */
  apiUrl: 'https://semitextural-hyun-overpolemically.ngrok-free.dev/api/v1',
  mapbox: {
    accessToken: ""
  }
};
