import mapboxgl from 'mapbox-gl';

let mapboxWorkerConfigured = false;

/**
 * Angular's build pipeline transpiles Mapbox GL's default worker bundle incorrectly,
 * which breaks tile loading (WebWorker parse error, `_asyncToGenerator is not defined`).
 * Use the official CSP worker script from app assets instead (copied at build time).
 *
 * @see https://docs.mapbox.com/mapbox-gl-js/guides/install/#bundling-with-other-module-systems
 */
export function configureMapboxGlWorker(): void {
  if (mapboxWorkerConfigured || typeof document === 'undefined') {
    return;
  }
  mapboxWorkerConfigured = true;
  const href = new URL('assets/mapbox-gl-csp-worker.js', document.baseURI).href;
  mapboxgl.workerUrl = href;
}

/** Run at import time so `workerUrl` is set before AppModule loads any mapbox-gl consumers. */
configureMapboxGlWorker();
