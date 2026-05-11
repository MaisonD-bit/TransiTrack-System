/**
 * Terminal manager: add bus stops on operator route paths (Mapbox).
 * Bundled via Vite so Mapbox loads before init (fixes blank map).
 */

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

/** Promise resolver for #tmBusStopNameModal — resolves stop name string or null */
let tmStopNameResolver = null;

/** Assumed average speed (km/h) along the drawn path for ETA = f(distance). Tune if needed. */
const TM_ETA_AVG_SPEED_KMH = 25;

/**
 * ETA in whole minutes from cumulative distance (km) along the route from the terminal.
 */
function etaMinutesFromDistanceKm(distanceKm, avgSpeedKmh = TM_ETA_AVG_SPEED_KMH) {
    const km = Number(distanceKm);
    if (!km || km <= 0 || !avgSpeedKmh || avgSpeedKmh <= 0) return 0;
    return Math.max(0, Math.round((km / avgSpeedKmh) * 60));
}

function attachTmBusStopModalOnce() {
    const modalEl = document.getElementById('tmBusStopNameModal');
    const input = document.getElementById('tmBusStopNameInput');
    const btnSave = document.getElementById('tmBusStopNameSave');
    if (!modalEl || !input || !btnSave || btnSave.dataset.bound === '1') return;
    btnSave.dataset.bound = '1';

    function submitModal() {
        const name = (input.value || '').trim() || 'Stop';
        const resolve = tmStopNameResolver;
        tmStopNameResolver = null;
        if (resolve) resolve(name);
        const inst = bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
    }

    btnSave.addEventListener('click', submitModal);

    modalEl.addEventListener('hidden.bs.modal', () => {
        if (tmStopNameResolver) {
            tmStopNameResolver(null);
            tmStopNameResolver = null;
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitModal();
        }
    });
}

/**
 * @param {string} defaultName
 */
function showTmBusStopModal(defaultName) {
    const modalEl = document.getElementById('tmBusStopNameModal');
    const input = document.getElementById('tmBusStopNameInput');
    if (!modalEl || !input || typeof bootstrap === 'undefined') {
        return Promise.resolve(null);
    }
    attachTmBusStopModalOnce();
    input.value = defaultName || '';

    return new Promise((resolve) => {
        tmStopNameResolver = resolve;
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
        setTimeout(() => {
            input.focus();
            input.select();
        }, 400);
    });
}

const TERMINALS = {
    north: { coordinates: [123.920994, 10.311008], name: 'Cebu North Bus Terminal' },
    south: { coordinates: [123.893356, 10.298361], name: 'Cebu South Bus Terminal' },
};

function haversineKm(lng1, lat1, lng2, lat2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function cumulativeDistancesKm(coords) {
    const out = [0];
    for (let i = 1; i < coords.length; i++) {
        const a = coords[i - 1];
        const b = coords[i];
        const d = haversineKm(a[0], a[1], b[0], b[1]);
        out.push(out[i - 1] + d);
    }
    return out;
}

function closestOnSegment(lng0, lat0, lng1, lat1, plng, plat) {
    const ax = lng0;
    const ay = lat0;
    const bx = lng1;
    const by = lat1;
    const px = plng;
    const py = plat;
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby;
    let t = ab2 < 1e-12 ? 0 : (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const x = ax + t * abx;
    const y = ay + t * aby;
    const distA = haversineKm(ax, ay, x, y);
    return { t, lng: x, lat: y, distFromA: distA };
}

function projectOntoLine(coords, plng, plat) {
    if (!coords || coords.length < 2) return null;
    const cum = cumulativeDistancesKm(coords);
    let best = null;
    for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i];
        const b = coords[i + 1];
        const { t, lng, lat, distFromA } = closestOnSegment(a[0], a[1], b[0], b[1], plng, plat);
        const dClick = haversineKm(plng, plat, lng, lat);
        if (!best || dClick < best.dClick) {
            best = {
                segIndex: i,
                t,
                lng,
                lat,
                distFromStart: cum[i] + distFromA,
                dClick,
            };
        }
    }
    return best;
}

function normalizeLineString(geometry) {
    if (!geometry) return null;
    let g = geometry;
    if (typeof g === 'string') {
        try {
            g = JSON.parse(g);
        } catch {
            return null;
        }
    }
    if (g.type === 'Feature' && g.geometry) g = g.geometry;
    if (g.type !== 'LineString' || !Array.isArray(g.coordinates)) return null;
    return g.coordinates
        .map((c) => {
            if (!c || c.length < 2) return null;
            const lng = typeof c[0] === 'string' ? parseFloat(c[0]) : c[0];
            const lat = typeof c[1] === 'string' ? parseFloat(c[1]) : c[1];
            if (Number.isNaN(lng) || Number.isNaN(lat)) return null;
            if (Math.abs(lng) <= 90 && Math.abs(lat) > 90) return [lat, lng];
            return [lng, lat];
        })
        .filter(Boolean);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function scheduleMapResize(map) {
    const run = () => {
        try {
            map.resize();
        } catch {
            /* ignore */
        }
    };
    run();
    requestAnimationFrame(run);
    setTimeout(run, 50);
    setTimeout(run, 300);
    window.addEventListener('resize', run);
}

function initTerminalStopMaps() {
    const token = typeof window !== 'undefined' ? window.TM_MAPBOX_TOKEN || '' : '';
    if (!token) {
        console.warn('TM_MAPBOX_TOKEN missing — set MAPBOX_TOKEN in .env');
    }
    mapboxgl.accessToken = token || 'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA';

    document.querySelectorAll('[data-tm-stop-editor]').forEach((card) => {
        const reqId = card.getAttribute('data-request-id');
        const terminalRaw = card.getAttribute('data-terminal') || 'north';
        const terminalKey = terminalRaw.toLowerCase();

        let routesMetaForMap = [];
        let fullRoutesMeta = [];

        const jsonEl = card.querySelector('script.tm-editor-json[type="application/json"]');
        if (jsonEl && jsonEl.textContent) {
            try {
                const cfg = JSON.parse(jsonEl.textContent.trim());
                routesMetaForMap = cfg.routesForMap || cfg.routes || [];
                fullRoutesMeta = cfg.fullRoutes || routesMetaForMap;
            } catch (e) {
                console.error('tm-editor-json parse failed', e);
            }
        }

        if (!routesMetaForMap.length) {
            try {
                routesMetaForMap = JSON.parse(card.getAttribute('data-routes') || '[]');
            } catch (e) {
                console.error('data-routes parse failed', e);
            }
        }
        try {
            const fr = JSON.parse(card.getAttribute('data-full-routes') || '[]');
            if (!fullRoutesMeta.length && Array.isArray(fr) && fr.length) {
                fullRoutesMeta = fr;
            }
        } catch {
            /* ignore */
        }
        if (!fullRoutesMeta.length) {
            fullRoutesMeta = routesMetaForMap;
        }

        const mapEl = card.querySelector(`[data-tm-map="${reqId}"]`);
        const routeSelect = card.querySelector(`[data-active-route="${reqId}"]`);
        const stopJsonField = card.querySelector(`textarea[data-stop-json="${reqId}"]`);
        const tbody = card.querySelector(`[data-stops-tbody="${reqId}"]`);
        const form = card.querySelector(`[data-stops-form="${reqId}"]`);
        const warnEl = card.querySelector('[data-tm-map-warning]');

        if (!routesMetaForMap.length && warnEl) {
            warnEl.textContent =
                'Route data failed to load (invalid JSON). Refresh the page or contact support if this persists.';
            warnEl.classList.remove('d-none');
        }

        if (!mapEl || typeof mapboxgl === 'undefined') return;

        const term = TERMINALS[terminalKey] || TERMINALS.north;

        let map;
        try {
            map = new mapboxgl.Map({
                container: mapEl,
                style: 'mapbox://styles/mapbox/streets-v12',
                center: term.coordinates,
                zoom: 11,
            });
        } catch (err) {
            console.error('Mapbox Map()', err);
            const w = card.querySelector('[data-tm-map-warning]');
            if (w) {
                w.textContent =
                    'Could not start the map (' +
                    (err && err.message ? err.message : 'unknown error') +
                    '). Try another browser or disable strict blocking for api.mapbox.com.';
                w.classList.remove('d-none');
            }
            return;
        }
        map.addControl(new mapboxgl.NavigationControl());
        scheduleMapResize(map);

        map.on('error', (e) => {
            console.error('Mapbox error', e);
        });

        const routeLayers = [];
        const markersByReq = [];
        let stopsByRoute = {};
        let activeRouteId = routesMetaForMap.length ? String(routesMetaForMap[0].id) : null;

        try {
            const existing = JSON.parse(stopJsonField?.value || '[]');
            if (Array.isArray(existing)) {
                existing.forEach((block) => {
                    const rid = String(block.route_id);
                    stopsByRoute[rid] = (block.stops || []).map((s, idx) => ({
                        order: idx,
                        name: s.name || `Stop ${idx + 1}`,
                        lng: parseFloat(s.lng),
                        lat: parseFloat(s.lat),
                        eta_minutes: parseInt(s.eta_minutes, 10) || 0,
                        distance_km_from_start: parseFloat(s.distance_km_from_start) || 0,
                    }));
                });
            }
        } catch {
            /* ignore */
        }

        /** Ensures the terminal is always stop 0 for the given route. */
        function ensureTerminalStop(routeId) {
            const rid = String(routeId);
            if (!stopsByRoute[rid]) stopsByRoute[rid] = [];
            const first = stopsByRoute[rid][0];
            if (!first || (first.distance_km_from_start ?? 1) > 0.01) {
                stopsByRoute[rid].unshift({
                    name: term.name,
                    lng: term.coordinates[0],
                    lat: term.coordinates[1],
                    eta_minutes: 0,
                    distance_km_from_start: 0,
                    _isTerminal: true,
                });
            }
        }

        /** Ensures the route endpoint is always the last stop. */
        function ensureEndpointStop(routeId) {
            const rid = String(routeId);
            if (!stopsByRoute[rid]) stopsByRoute[rid] = [];

            const meta = fullRoutesMeta.find((r) => String(r.id) === rid);
            if (!meta) return;

            // Coordinates: prefer explicit end_coords, fall back to last geometry point
            let endCoords = meta.end_coords;
            if (!endCoords) {
                const coords = normalizeLineString(meta.geometry);
                if (!coords || !coords.length) return;
                endCoords = coords[coords.length - 1];
            }
            if (!endCoords) return;

            // Name: use end_location, or parse "Cebu to Tayud" → "Tayud"
            let endName = meta.end_location;
            if (!endName && meta.name) {
                const parts = meta.name.split(/ to /i);
                if (parts.length >= 2) endName = parts[parts.length - 1].trim();
            }
            endName = endName || 'Destination';

            const distanceKm = meta.distance_km || 0;
            const list = stopsByRoute[rid];
            const last = list[list.length - 1];

            // Skip if last stop is already at or near the endpoint
            if (last && !last._isTerminal) {
                const dx = last.lng - endCoords[0];
                const dy = last.lat - endCoords[1];
                if (Math.sqrt(dx * dx + dy * dy) < 0.001) return;
            }

            list.push({
                name: endName,
                lng: endCoords[0],
                lat: endCoords[1],
                eta_minutes: etaMinutesFromDistanceKm(distanceKm),
                distance_km_from_start: distanceKm,
                _isEndpoint: true,
            });
        }

        // Auto-add terminal as stop 0 and endpoint as last stop for every route on first load
        fullRoutesMeta.forEach((r) => {
            ensureTerminalStop(r.id);
            ensureEndpointStop(r.id);
        });

        function syncHiddenJson() {
            const payload = fullRoutesMeta.map((r) => ({
                route_id: r.id,
                label: r.name,
                stops: (stopsByRoute[String(r.id)] || []).map((s, idx) => ({
                    order: idx,
                    name: s.name,
                    lng: s.lng,
                    lat: s.lat,
                    eta_minutes: s.eta_minutes || 0,
                    distance_km_from_start: Math.round((s.distance_km_from_start || 0) * 1000) / 1000,
                })),
            }));
            if (stopJsonField) stopJsonField.value = JSON.stringify(payload);
            renderStopTable();
            redrawMarkers();
        }

        function redrawMarkers() {
            markersByReq.forEach((m) => m.remove());
            markersByReq.length = 0;
            if (!activeRouteId) return;
            const list = stopsByRoute[activeRouteId] || [];
            list.forEach((s, idx) => {
                const el = document.createElement('div');
                el.className = 'tm-stop-marker';
                if (s._isTerminal) {
                    el.style.cssText =
                        'width:28px;height:28px;border-radius:50%;background:#2ecc71;color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)';
                    el.textContent = 'T';
                } else if (s._isEndpoint) {
                    el.style.cssText =
                        'width:28px;height:28px;border-radius:50%;background:#e74c3c;color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)';
                    el.textContent = 'E';
                } else {
                    el.style.cssText =
                        'width:26px;height:26px;border-radius:50%;background:#3498db;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)';
                    el.textContent = String(idx); // idx 0 = terminal, last = endpoint
                }
                const mk = new mapboxgl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map);
                markersByReq.push(mk);
            });
        }

        function renderStopTable() {
            if (!tbody) return;
            tbody.innerHTML = '';
            const list = activeRouteId ? stopsByRoute[activeRouteId] || [] : [];
            list.forEach((s, idx) => {
                const tr = document.createElement('tr');
                const isTerminal = s._isTerminal === true;
                const isEndpoint = s._isEndpoint === true;
                if (isTerminal) {
                    tr.innerHTML = `
          <td><span class="badge bg-success">T</span></td>
          <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(s.name)}" readonly style="background:#f8f9fa;color:#6c757d;" /></td>
          <td><span class="text-muted small">0</span></td>
          <td class="small">0.00</td>
          <td><span title="Terminal stop — cannot be removed" style="color:#aaa;cursor:default;">🔒</span></td>`;
                } else if (isEndpoint) {
                    tr.innerHTML = `
          <td><span class="badge bg-danger">E</span></td>
          <td><input type="text" class="form-control form-control-sm" value="${escapeHtml(s.name)}" readonly style="background:#f8f9fa;color:#6c757d;" /></td>
          <td><span class="text-muted small">${s.eta_minutes ?? 0}</span></td>
          <td class="small">${(s.distance_km_from_start ?? 0).toFixed(2)}</td>
          <td><span title="Endpoint — cannot be removed" style="color:#aaa;cursor:default;">🔒</span></td>`;
                } else {
                    tr.innerHTML = `
          <td>${idx}</td>
          <td><input type="text" class="form-control form-control-sm tm-stop-name" data-idx="${idx}" value="${escapeHtml(s.name)}" /></td>
          <td><input type="number" class="form-control form-control-sm tm-stop-eta" data-idx="${idx}" min="0" step="1" value="${s.eta_minutes ?? 0}" /></td>
          <td class="small">${(s.distance_km_from_start ?? 0).toFixed(2)}</td>
          <td><button type="button" class="btn btn-sm btn-outline-danger tm-remove-stop" data-idx="${idx}"><i class="fas fa-times"></i></button></td>`;
                }
                tbody.appendChild(tr);
            });

            tbody.querySelectorAll('.tm-stop-name').forEach((inp) => {
                inp.addEventListener('change', () => {
                    const idx = parseInt(inp.getAttribute('data-idx'), 10);
                    if (stopsByRoute[activeRouteId]?.[idx]) stopsByRoute[activeRouteId][idx].name = inp.value;
                    syncHiddenJson();
                });
            });
            tbody.querySelectorAll('.tm-stop-eta').forEach((inp) => {
                inp.addEventListener('change', () => {
                    const idx = parseInt(inp.getAttribute('data-idx'), 10);
                    if (stopsByRoute[activeRouteId]?.[idx])
                        stopsByRoute[activeRouteId][idx].eta_minutes = parseInt(inp.value, 10) || 0;
                    syncHiddenJson();
                });
            });
            tbody.querySelectorAll('.tm-remove-stop').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.getAttribute('data-idx'), 10);
                    stopsByRoute[activeRouteId].splice(idx, 1);
                    syncHiddenJson();
                });
            });
        }

        let anyLine = false;
        map.on('load', () => {
            scheduleMapResize(map);

            const colors = ['#e74c3c', '#9b59b6', '#27ae60', '#f39c12', '#1abc9c'];
            routesMetaForMap.forEach((r, i) => {
                const coords = normalizeLineString(r.geometry);
                if (!coords || coords.length < 2) return;
                anyLine = true;
                const srcId = `tm-route-${reqId}-${r.id}`;
                map.addSource(srcId, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: { type: 'LineString', coordinates: coords },
                    },
                });
                map.addLayer({
                    id: `${srcId}-line`,
                    type: 'line',
                    source: srcId,
                    paint: {
                        'line-color': colors[i % colors.length],
                        'line-width': 5,
                        'line-opacity': 0.85,
                    },
                });
                routeLayers.push({ id: r.id, coords });
            });

            if (!anyLine && warnEl) {
                warnEl.textContent =
                    'No route path geometry found for this route in the database. Ask the bus operator to save the route path on the operator panel (Routes), then try again.';
                warnEl.classList.remove('d-none');
            }

            new mapboxgl.Marker({ color: '#2ecc71' })
                .setLngLat(term.coordinates)
                .setPopup(new mapboxgl.Popup().setHTML(`<strong>${term.name}</strong>`))
                .addTo(map);

            const bounds = new mapboxgl.LngLatBounds();
            routesMetaForMap.forEach((r) => {
                const c = normalizeLineString(r.geometry);
                if (c) c.forEach((pt) => bounds.extend(pt));
            });
            if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 13 });

            syncHiddenJson();
        });

        if (routeSelect && routesMetaForMap.length > 1) {
            routeSelect.classList.remove('d-none');
            routeSelect.addEventListener('change', () => {
                activeRouteId = routeSelect.value;
                redrawMarkers();
                renderStopTable();
            });
            routeSelect.value = activeRouteId || '';
        }

        map.on('click', (e) => {
            if (!activeRouteId) {
                alert('Select a route first, then click the line to add a stop.');
                return;
            }
            const meta = routesMetaForMap.find((x) => String(x.id) === String(activeRouteId));
            if (!meta) return;
            const coords = normalizeLineString(meta.geometry);
            if (!coords || coords.length < 2) return;
            const proj = projectOntoLine(coords, e.lngLat.lng, e.lngLat.lat);
            if (!proj || proj.dClick > 0.08) {
                alert('Click closer to the highlighted route path.');
                return;
            }
            // Terminal is always stop 0; user-added stops start at 1
            const nonTerminalCount = (stopsByRoute[activeRouteId] || []).filter(s => !s._isTerminal).length;
            const defaultStopLabel = `Stop ${nonTerminalCount + 1}`;
            const etaAuto = etaMinutesFromDistanceKm(proj.distFromStart);
            showTmBusStopModal(defaultStopLabel).then((stopName) => {
                if (stopName === null || stopName === undefined) return;
                if (!stopsByRoute[activeRouteId]) stopsByRoute[activeRouteId] = [];
                const list = stopsByRoute[activeRouteId];
                const newStop = {
                    name: stopName || 'Stop',
                    lng: proj.lng,
                    lat: proj.lat,
                    eta_minutes: etaAuto,
                    distance_km_from_start: proj.distFromStart,
                };
                // Insert before endpoint if present, otherwise append
                const endIdx = list.findIndex((s) => s._isEndpoint);
                if (endIdx !== -1) {
                    list.splice(endIdx, 0, newStop);
                } else {
                    list.push(newStop);
                }
                syncHiddenJson();
            });
        });

        const clearBtn = card.querySelector(`[data-clear-stops="${reqId}"]`);
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (!activeRouteId) return;
                if (!confirm('Remove all stops for this route?')) return;
                stopsByRoute[activeRouteId] = [];
                ensureTerminalStop(activeRouteId);
                ensureEndpointStop(activeRouteId);
                syncHiddenJson();
            });
        }

        if (form) {
            form.addEventListener('submit', () => {
                syncHiddenJson();
            });
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTerminalStopMaps);
} else {
    initTerminalStopMaps();
}
