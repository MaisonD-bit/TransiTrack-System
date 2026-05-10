/**
 * Terminal manager: add bus stops on top of operator route paths (Mapbox).
 * Persists stop_configuration as JSON for each approval request.
 */

/** Promise resolver for #tmBusStopNameModal (TransiTrack-styled modal vs window.prompt) */
let tmStopNameResolver = null;

function attachTmBusStopModalOnce() {
    const modalEl = document.getElementById('tmBusStopNameModal');
    const input = document.getElementById('tmBusStopNameInput');
    const btnSave = document.getElementById('tmBusStopNameSave');
    if (!modalEl || !input || !btnSave || btnSave.dataset.bound === '1') return;
    btnSave.dataset.bound = '1';

    btnSave.addEventListener('click', () => {
        const name = (input.value || '').trim() || 'Stop';
        const resolve = tmStopNameResolver;
        tmStopNameResolver = null;
        if (resolve) resolve(name);
        const inst = bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
    });

    modalEl.addEventListener('hidden.bs.modal', () => {
        if (tmStopNameResolver) {
            tmStopNameResolver(null);
            tmStopNameResolver = null;
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnSave.click();
        }
    });
}

/**
 * @param {string} defaultName
 * @returns {Promise<string|null>}
 */
function showTmBusStopNameModal(defaultName) {
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

/** @returns {number[]} cumulative km from first coordinate along polyline */
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

/** Closest point on segment AB to P; returns { t, lng, lat, distFromA } */
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

/**
 * @param {number[][]} coords LineString [lng,lat] pairs
 * @param {number} plng
 * @param {number} plat
 */
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

function initTerminalStopMaps() {
    document.querySelectorAll('[data-tm-stop-editor]').forEach((card) => {
        const reqId = card.getAttribute('data-request-id');
        const terminal = card.getAttribute('data-terminal') || 'north';
        let routesMeta = [];
        try {
            routesMeta = JSON.parse(card.getAttribute('data-routes') || '[]');
        } catch (e) {
            console.error(e);
            return;
        }

        const mapEl = card.querySelector(`[data-tm-map="${reqId}"]`);
        const routeSelect = card.querySelector(`[data-active-route="${reqId}"]`);
        const stopJsonField = card.querySelector(`textarea[data-stop-json="${reqId}"]`);
        const tbody = card.querySelector(`[data-stops-tbody="${reqId}"]`);
        const form = card.querySelector(`[data-stops-form="${reqId}"]`);

        if (!mapEl || typeof mapboxgl === 'undefined') return;

        const term = TERMINALS[terminal] || TERMINALS.north;
        const map = new mapboxgl.Map({
            container: mapEl,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: term.coordinates,
            zoom: 11,
        });
        map.addControl(new mapboxgl.NavigationControl());

        const routeLayers = [];
        const markersByReq = [];
        let stopsByRoute = {};
        let activeRouteId = routesMeta.length ? String(routesMeta[0].id) : null;

        /** hydrate from existing saved config */
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
        } catch (e) {
            /* ignore */
        }

        function syncHiddenJson() {
            const payload = routesMeta.map((r) => ({
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
                el.style.cssText =
                    'width:26px;height:26px;border-radius:50%;background:#3498db;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)';
                el.textContent = String(idx + 1);
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
                tr.innerHTML = `
          <td>${idx + 1}</td>
          <td><input type="text" class="form-control form-control-sm tm-stop-name" data-idx="${idx}" value="${escapeHtml(s.name)}" /></td>
          <td><input type="number" class="form-control form-control-sm tm-stop-eta" data-idx="${idx}" min="0" step="1" value="${s.eta_minutes ?? 0}" /></td>
          <td class="small">${(s.distance_km_from_start ?? 0).toFixed(2)}</td>
          <td><button type="button" class="btn btn-sm btn-outline-danger tm-remove-stop" data-idx="${idx}"><i class="fas fa-times"></i></button></td>`;
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

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        map.on('load', () => {
            const colors = ['#e74c3c', '#9b59b6', '#27ae60', '#f39c12', '#1abc9c'];
            routesMeta.forEach((r, i) => {
                const coords = normalizeLineString(r.geometry);
                if (!coords || coords.length < 2) return;
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

            new mapboxgl.Marker({ color: '#2ecc71' }).setLngLat(term.coordinates).setPopup(new mapboxgl.Popup().setHTML(`<strong>${term.name}</strong>`)).addTo(map);

            const bounds = new mapboxgl.LngLatBounds();
            routesMeta.forEach((r) => {
                const c = normalizeLineString(r.geometry);
                if (c) c.forEach((pt) => bounds.extend(pt));
            });
            if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 13 });

            syncHiddenJson();
        });

        if (routeSelect) {
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
            const meta = routesMeta.find((x) => String(x.id) === String(activeRouteId));
            if (!meta) return;
            const coords = normalizeLineString(meta.geometry);
            if (!coords || coords.length < 2) return;
            const proj = projectOntoLine(coords, e.lngLat.lng, e.lngLat.lat);
            if (!proj || proj.dClick > 0.08) {
                alert('Click closer to the highlighted route path.');
                return;
            }
            const defaultStopLabel = `Stop ${(stopsByRoute[activeRouteId]?.length || 0) + 1}`;
            showTmBusStopNameModal(defaultStopLabel).then((stopName) => {
                if (stopName === null || stopName === undefined) return;
                if (!stopsByRoute[activeRouteId]) stopsByRoute[activeRouteId] = [];
                stopsByRoute[activeRouteId].push({
                    name: stopName || 'Stop',
                    lng: proj.lng,
                    lat: proj.lat,
                    eta_minutes: 0,
                    distance_km_from_start: proj.distFromStart,
                });
                syncHiddenJson();
            });
        });

        const clearBtn = card.querySelector(`[data-clear-stops="${reqId}"]`);
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (!activeRouteId) return;
                if (!confirm('Remove all stops for this route?')) return;
                stopsByRoute[activeRouteId] = [];
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
