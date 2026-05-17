/** Custom Mapbox marker element showing a bus icon (live bus position). */
export function createMapBusMarkerElement(options?: {
  scale?: number;
  ringColor?: string;
  title?: string;
}): HTMLElement {
  const scale = options?.scale ?? 1;
  const ring = options?.ringColor ?? '#0074D9';
  const el = document.createElement('div');
  el.className = 'map-bus-marker';
  el.title = options?.title ?? 'Bus';
  el.style.setProperty('--bus-marker-scale', String(scale));
  el.style.setProperty('--bus-marker-ring', ring);
  const img = document.createElement('img');
  img.src = 'assets/map/bus-location.svg';
  img.alt = 'Bus';
  img.draggable = false;
  el.appendChild(img);
  return el;
}
