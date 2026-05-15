export interface Environment {
  production: boolean;
  apiUrl: string;
  mapbox: {
    accessToken: string;
  };
  messaging: {
    streamApiKey: string;
  };
}
