export interface Environment {
  production: boolean;
  apiUrl: string;
  mapbox: {
    accessToken: string;
  };
}
