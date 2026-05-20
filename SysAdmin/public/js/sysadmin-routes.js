(function () {
    'use strict';

    let routeMap = null;
    let startMarker = null;
    let endMarker = null;
    let stopMarkers = [];
    let stops = [];
    let isAddingStop = false;
    /** @type {'add'|'view'|null} */
    let activeFormMode = null;
    let userTerminal = 'north';
    let currentTerminal = null;
    let routeToDelete = null;
    let destinationSearchRequestId = 0;

    const CEBU_COORDINATES = {
        center: [123.8854, 10.3157],
        zoom: 12,
    };

    const TERMINALS = {
        north: {
            coordinates: [123.920994, 10.311008],
            name: 'Cebu North Bus Terminal (SM City)',
        },
        south: {
            coordinates: [123.893356, 10.298361],
            name: 'Cebu South Bus Terminal',
        },
    };

    const TERMINAL_BOUNDARIES = {
        north: { swLng: 123.6, swLat: 10.28, neLng: 124.1, neLat: 11.3 },
        south: { swLng: 123.20, swLat: 9.38, neLng: 124.05, neLat: 10.31 },
    };

    currentTerminal = TERMINALS.north;

    // ---------------- helpers ----------------

    function parseRouteLineStringGeometry(geometry) {
        if (geometry == null) return null;
        let g = geometry;
        if (typeof g === 'string') {
            const t = g.trim();
            if (!t) return null;
            try { g = JSON.parse(t); } catch { return null; }
        }
        while (typeof g === 'string') {
            try { g = JSON.parse(g); } catch { return null; }
        }
        if (!g || typeof g !== 'object') return null;
        if (g.type === 'Feature' && g.geometry?.type === 'LineString' && Array.isArray(g.geometry.coordinates)) {
            return g.geometry;
        }
        if (g.type === 'LineString' && Array.isArray(g.coordinates)) return g;
        if (Array.isArray(g.coordinates) && g.coordinates.length > 0) {
            return { type: 'LineString', coordinates: g.coordinates };
        }
        if (g.type === 'FeatureCollection' && Array.isArray(g.features) && g.features[0]?.geometry) {
            return parseRouteLineStringGeometry(g.features[0].geometry);
        }
        return null;
    }

    function normalizeLineStringGeometry(geometry) {
        const raw = parseRouteLineStringGeometry(geometry);
        if (!raw || !Array.isArray(raw.coordinates)) return null;
        const coords = raw.coordinates
            .map((c) => {
                if (!c || c.length < 2) return null;
                let lng = typeof c[0] === 'string' ? parseFloat(c[0]) : Number(c[0]);
                let lat = typeof c[1] === 'string' ? parseFloat(c[1]) : Number(c[1]);
                if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
                if (Math.abs(lng) <= 90 && Math.abs(lat) > 90) [lng, lat] = [lat, lng];
                return [lng, lat];
            })
            .filter(Boolean);
        if (coords.length < 2) return null;
        return { type: 'LineString', coordinates: coords };
    }

    function parseCoordPair(coordStr) {
        if (!coordStr || typeof coordStr !== 'string') return null;
        const parts = coordStr.split(',').map((s) => parseFloat(s.trim()));
        if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return null;
        let [lng, lat] = parts;
        if (Math.abs(lng) <= 90 && Math.abs(lat) > 90) [lng, lat] = [lat, lng];
        return [lng, lat];
    }

    function geometryToFormString(geometry) {
        if (geometry == null) return '';
        if (typeof geometry === 'string') return geometry;
        try { return JSON.stringify(geometry); } catch { return ''; }
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const cls = type === 'error' ? 'danger' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info';
        toast.className = `position-fixed top-0 end-0 m-3 alert alert-${cls} alert-dismissible fade show`;
        toast.style.zIndex = '9999';
        toast.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.parentNode && toast.parentNode.removeChild(toast), 3000);
    }

    function getCurrentBoundary() {
        return TERMINAL_BOUNDARIES[userTerminal] || TERMINAL_BOUNDARIES.north;
    }

    function isPointInAllowedArea(lng, lat) {
        const b = getCurrentBoundary();
        return lng >= b.swLng && lng <= b.neLng && lat >= b.swLat && lat <= b.neLat;
    }

    // ---------------- sections ----------------

    function addSection() { return document.getElementById('routeFormSection'); }
    function viewSection() { return document.getElementById('viewRouteFormSection'); }

    function addEl(id) {
        const root = addSection();
        if (!root) return null;
        if (id === 'formTitle') return document.getElementById('add_formTitle');
        return root.querySelector('#' + id);
    }

    function viewEl(id) {
        const root = viewSection();
        if (!root) return null;
        const resolved = ({ formTitle: 'view_formTitle', stopsList: 'view_stopsList' })[id]
            || (id.startsWith('view_') ? id : 'view_' + id);
        return root.querySelector('#' + resolved) || document.getElementById(resolved);
    }

    function clearValidationErrors() {
        const root = addSection();
        if (!root) return;
        root.querySelectorAll('.form-control, .form-select').forEach((i) => i.classList.remove('is-invalid'));
        root.querySelectorAll('.invalid-feedback').forEach((d) => (d.textContent = ''));
    }

    function showValidationErrors(errors) {
        clearValidationErrors();
        const root = addSection();
        if (!root) return;
        for (const [field, messages] of Object.entries(errors)) {
            const inputId = field === 'code' ? 'route_code'
                : field === 'name' ? 'route_name'
                : field === 'status' ? 'route_status'
                : field;
            const input = root.querySelector('#' + inputId);
            const errorDiv = root.querySelector('#' + field + '_error');
            if (input && errorDiv) {
                input.classList.add('is-invalid');
                errorDiv.textContent = messages[0];
            }
        }
    }

    // ---------------- marker lifecycle ----------------

    function clearRouteMarkers() {
        [startMarker, endMarker].forEach((m) => { try { m && m.remove(); } catch (_) {} });
        startMarker = null;
        endMarker = null;
        stopMarkers.forEach((m) => { try { m.remove(); } catch (_) {} });
        stopMarkers = [];
    }

    function destroyMap() {
        clearRouteMarkers();
        detachResizeObserver();
        if (routeMap) {
            try { routeMap.remove(); } catch (_) {}
            routeMap = null;
        }
    }

    /**
     * Wait until the map is loaded, sized to the container, and idle.
     * Markers placed inside the callback are guaranteed to land at the
     * correct pixel position.
     */
    function whenMapReady(callback) {
        if (!routeMap || typeof callback !== 'function') return;
        const run = () => {
            try { routeMap.resize(); } catch (_) {}
            // One more frame so the resized canvas paints before we add markers
            requestAnimationFrame(() => callback());
        };
        if (routeMap.loaded()) {
            routeMap.once('idle', run);
        } else {
            routeMap.once('load', () => routeMap.once('idle', run));
        }
    }

    /**
     * Wait until the container is laid out (non-zero) AND visible in the
     * viewport. This is necessary because the form sections start as
     * `display: none`; without this guard, Mapbox would init against a
     * 0×0 canvas and every later marker would be projected to garbage.
     */
    /**
     * Resolve when the container AND its layout host both have non-zero
     * width and height. We measure both because the immediate parent
     * (.route-map-host) is the box that gives the map its 400px.
     */
    function whenContainerReady(containerId, cb) {
        const el = document.getElementById(containerId);
        if (!el) {
            console.warn('[routes] container missing:', containerId);
            return;
        }

        const measure = () => {
            const host = el.closest('.route-map-host') || el.parentElement;
            const w = el.offsetWidth || host?.offsetWidth || 0;
            const h = el.offsetHeight || host?.offsetHeight || 0;
            return { w, h, host };
        };

        let done = false;
        const finish = (why) => {
            if (done) return;
            done = true;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                const m = measure();
                console.log('[routes] container ready', containerId, m.w + 'x' + m.h, '(' + why + ')');
                cb(el);
            }));
        };

        const tryNow = () => {
            const m = measure();
            if (m.w > 0 && m.h > 0) finish('sync');
        };
        tryNow();
        if (done) return;

        // Force a paint + try again next frame (handles display:none → block)
        let frames = 0;
        const rafLoop = () => {
            if (done) return;
            frames += 1;
            const m = measure();
            if (m.w > 0 && m.h > 0) { finish('raf ' + frames); return; }
            if (frames < 60) requestAnimationFrame(rafLoop);
        };
        requestAnimationFrame(rafLoop);

        // Final safety net
        setTimeout(() => {
            if (done) return;
            const m = measure();
            console.warn('[routes] container never sized, forcing init', containerId, m.w + 'x' + m.h);
            finish('timeout');
        }, 1500);
    }

    /** Attach a ResizeObserver that resizes the map on every container change. */
    function attachResizeObserver(containerEl) {
        if (!routeMap || !containerEl || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => {
            try { routeMap && routeMap.resize(); } catch (_) {}
        });
        ro.observe(containerEl);
        routeMap.__sysadminResizeObserver = ro;
    }

    function detachResizeObserver() {
        if (routeMap && routeMap.__sysadminResizeObserver) {
            try { routeMap.__sysadminResizeObserver.disconnect(); } catch (_) {}
            routeMap.__sysadminResizeObserver = null;
        }
    }

    // ---------------- terminal selection ----------------

    function getSelectedTerminalKey() {
        const select = document.getElementById('route_terminal_select');
        if (select?.value && TERMINALS[select.value]) return select.value;
        return userTerminal || 'north';
    }

    function setTerminal(key, options = {}) {
        key = TERMINALS[key] ? key : 'north';
        userTerminal = key;
        currentTerminal = TERMINALS[key];

        const hidden = document.getElementById('route_terminal');
        const select = document.getElementById('route_terminal_select');
        if (hidden) hidden.value = key;
        if (select && select.value !== key) select.value = key;

        const labelText = key.charAt(0).toUpperCase() + key.slice(1) + ' Bus Terminal';
        const addLabel = document.getElementById('add_terminal_label');
        if (addLabel) addLabel.textContent = labelText;
        const addLabelInline = document.getElementById('add_terminal_label_inline');
        if (addLabelInline) addLabelInline.textContent = labelText;

        if (options.updateStartFields !== false && activeFormMode === 'add') {
            if (addEl('start_location')) addEl('start_location').value = currentTerminal.name;
            if (addEl('start_coordinates')) {
                addEl('start_coordinates').value = currentTerminal.coordinates[0] + ',' + currentTerminal.coordinates[1];
            }
        }

        if (startMarker) {
            try { startMarker.setLngLat(currentTerminal.coordinates); } catch (_) {}
        }

        if (routeMap && !options.skipBoundary) refreshBoundaryLayers();
        if (routeMap && options.flyTo !== false) {
            routeMap.flyTo({
                center: currentTerminal.coordinates,
                zoom: CEBU_COORDINATES.zoom,
                duration: options.flyTo === true ? 800 : 0,
            });
        }
    }

    function addTerminalBoundaryLayers() {
        if (!routeMap) return;
        const b = getCurrentBoundary();
        const polygon = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [b.swLng, b.swLat],
                    [b.neLng, b.swLat],
                    [b.neLng, b.neLat],
                    [b.swLng, b.neLat],
                    [b.swLng, b.swLat],
                ]],
            },
        };
        routeMap.addSource('cebu-boundary', { type: 'geojson', data: polygon });
        routeMap.addLayer({
            id: 'cebu-fill',
            type: 'fill',
            source: 'cebu-boundary',
            paint: { 'fill-color': '#0080ff', 'fill-opacity': 0.15 },
        });
        routeMap.addLayer({
            id: 'cebu-border',
            type: 'line',
            source: 'cebu-boundary',
            paint: { 'line-color': '#0080ff', 'line-width': 2, 'line-dasharray': [2, 2] },
        });
    }

    function refreshBoundaryLayers() {
        if (!routeMap?.isStyleLoaded()) return;
        if (routeMap.getLayer('cebu-border')) routeMap.removeLayer('cebu-border');
        if (routeMap.getLayer('cebu-fill')) routeMap.removeLayer('cebu-fill');
        if (routeMap.getSource('cebu-boundary')) routeMap.removeSource('cebu-boundary');
        addTerminalBoundaryLayers();
    }

    // ---------------- map init ----------------

    function initializeMap(options) {
        options = options || {};
        const mode = options.mode || activeFormMode || 'add';
        const readOnly = options.readOnly === true || mode === 'view';
        const containerId = mode === 'view' ? 'viewRouteMap' : 'routeMap';
        const onReady = typeof options.onReady === 'function' ? options.onReady : null;

        destroyMap();

        const el = document.getElementById(containerId);
        if (!el) {
            console.error('[routes] map container not found:', containerId);
            return;
        }

        console.log('[routes] init map', containerId, 'size', el.offsetWidth + 'x' + el.offsetHeight);

        const terminal = currentTerminal || TERMINALS.north;
        routeMap = new mapboxgl.Map({
            container: el,
            style: 'mapbox://styles/mapbox/streets-v11',
            center: terminal.coordinates,
            zoom: CEBU_COORDINATES.zoom,
            attributionControl: true,
        });
        routeMap.addControl(new mapboxgl.NavigationControl());

        // Resize on any layout change of the container (the main fix).
        attachResizeObserver(el);

        // Belt-and-suspenders: extra resizes at staggered intervals to catch
        // any post-init layout shifts (sidebar collapse, fonts loading, etc).
        [50, 200, 600, 1200].forEach((ms) => {
            setTimeout(() => { try { routeMap && routeMap.resize(); } catch (_) {} }, ms);
        });

        routeMap.once('load', () => {
            try { routeMap.resize(); } catch (_) {}
            if (!readOnly) addTerminalBoundaryLayers();
        });

        whenMapReady(() => {
            if (!readOnly) {
                startMarker = new mapboxgl.Marker({ color: 'green' })
                    .setLngLat(terminal.coordinates)
                    .addTo(routeMap);
            }
            if (onReady) onReady(routeMap);
        });

        if (!readOnly) {
            routeMap.on('click', (e) => {
                if (isAddingStop) addStop(e.lngLat);
                else if (!endMarker) setEndPoint(e.lngLat);
            });
        }
    }

    // ---------------- markers for a saved route ----------------

    // Toggles the "Add Pathway" / "Clear Stops" controls and the stops list.
    // Pathway editing is only available in EDIT mode (not Add, not View).
    function setPathwayControlsVisible(visible) {
        const controls = document.getElementById('pathwayControls');
        if (controls) {
            controls.style.setProperty('display', visible ? 'flex' : 'none', 'important');
        }
        const list = document.getElementById('stopsList');
        if (list) list.style.display = visible ? 'block' : 'none';
    }

    function placeMarkersForRoute(route, options) {
        if (!routeMap) {
            console.warn('[routes] placeMarkersForRoute: no map');
            return;
        }
        options = options || {};
        const showStops = options.showStops === true;
        clearRouteMarkers();

        const terminal = route.terminal && TERMINALS[route.terminal]
            ? TERMINALS[route.terminal]
            : currentTerminal || TERMINALS.north;

        const line = normalizeLineStringGeometry(route.geometry);
        let startPt = parseCoordPair(route.start_coordinates);
        let endPt = parseCoordPair(route.end_coordinates);

        if (line?.coordinates?.length >= 2) {
            startPt = startPt || line.coordinates[0];
            endPt = endPt || line.coordinates[line.coordinates.length - 1];
        }
        if (!startPt) startPt = terminal.coordinates;

        console.log('[routes] placing markers', { startPt, endPt, showStops });

        startMarker = new mapboxgl.Marker({ color: '#16a34a' })
            .setLngLat(startPt)
            .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(
                '<strong>Start</strong><br><span class="small text-muted">' + (route.start_location || terminal.name) + '</span>'
            ))
            .addTo(routeMap);

        if (endPt) {
            endMarker = new mapboxgl.Marker({ color: '#dc2626' })
                .setLngLat(endPt)
                .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(
                    '<strong>Destination</strong><br><span class="small text-muted">' + (route.end_location || '') + '</span>'
                ))
                .addTo(routeMap);
        }

        if (showStops) {
            const stopsArr = Array.isArray(route.stops_data) ? route.stops_data : [];
            stopsArr.forEach((s) => {
                const lng = s.lng != null ? Number(s.lng) : NaN;
                const lat = s.lat != null ? Number(s.lat) : NaN;
                if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
                const m = new mapboxgl.Marker({ color: '#2563eb' })
                    .setLngLat([lng, lat])
                    .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(
                        '<strong>Pathway Stop</strong><br><span class="small text-muted">' + (s.name || '') + '</span>'
                    ))
                    .addTo(routeMap);
                stopMarkers.push(m);
            });
        }
    }

    // ---------------- pathway drawing ----------------

    function drawRoute(geometry) {
        if (!routeMap || !geometry) return;
        const line = normalizeLineStringGeometry(geometry);
        if (!line) return;

        const apply = () => {
            window.lastRouteGeometry = line;
            try {
                if (routeMap.getLayer('route')) routeMap.removeLayer('route');
                if (routeMap.getSource('route')) routeMap.removeSource('route');
                routeMap.addSource('route', {
                    type: 'geojson',
                    data: { type: 'Feature', properties: {}, geometry: line },
                });
                routeMap.addLayer({
                    id: 'route',
                    type: 'line',
                    source: 'route',
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': '#3b82f6', 'line-width': 5, 'line-opacity': 0.9 },
                });
            } catch (e) {
                console.error('drawRoute failed:', e);
            }
        };

        if (routeMap.isStyleLoaded()) apply();
        else routeMap.once('load', apply);
    }

    function fitMapToLine(line) {
        if (!routeMap || !line?.coordinates?.length) return;
        const bounds = new mapboxgl.LngLatBounds();
        line.coordinates.forEach((c) => bounds.extend(c));
        routeMap.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }

    function buildWaypointsFromRoute(route) {
        const terminal = currentTerminal || TERMINALS.north;
        const pts = [parseCoordPair(route.start_coordinates) || terminal.coordinates];
        (route.stops_data || []).forEach((s) => {
            const lng = s.lng != null ? Number(s.lng) : NaN;
            const lat = s.lat != null ? Number(s.lat) : NaN;
            if (Number.isFinite(lng) && Number.isFinite(lat)) pts.push([lng, lat]);
        });
        const end = parseCoordPair(route.end_coordinates);
        if (end) pts.push(end);
        return pts;
    }

    async function fetchDrivingRouteGeometry(waypoints) {
        if (!waypoints || waypoints.length < 2 || !mapboxgl.accessToken) return null;
        const url = 'https://api.mapbox.com/directions/v5/mapbox/driving/'
            + waypoints.map(([lng, lat]) => lng + ',' + lat).join(';')
            + '?geometries=geojson&overview=full&access_token=' + mapboxgl.accessToken;
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            return data.routes?.[0]?.geometry ? normalizeLineStringGeometry(data.routes[0].geometry) : null;
        } catch (e) {
            console.warn('fetchDrivingRouteGeometry failed:', e);
            return null;
        }
    }

    async function renderSavedPath(route) {
        let line = normalizeLineStringGeometry(route.geometry);
        if (!line) {
            const wps = buildWaypointsFromRoute(route);
            if (wps.length >= 2) line = await fetchDrivingRouteGeometry(wps);
        }
        if (!line || !routeMap) return;
        drawRoute(line);
        fitMapToLine(line);
    }

    // ---------------- add-mode interactions ----------------

    function setEndPoint(coords, knownPlaceName) {
        if (!isPointInAllowedArea(coords.lng, coords.lat)) {
            const tname = userTerminal === 'south' ? 'Southern Cebu' : 'Northern Cebu';
            showToast('Destination must be in ' + tname + '. Please pick inside the highlighted blue area.', 'error');
            return;
        }
        if (endMarker) endMarker.remove();
        endMarker = new mapboxgl.Marker({ color: 'red' }).setLngLat(coords).addTo(routeMap);

        const applyPlaceName = (placeName) => {
            if (addEl('end_location')) addEl('end_location').value = placeName;
            if (addEl('end_coordinates')) addEl('end_coordinates').value = coords.lng + ',' + coords.lat;
            autoGenerateRouteCode(placeName);
            calculateRouteWithStops();
        };

        if (knownPlaceName) applyPlaceName(knownPlaceName);
        else getPlaceName(coords.lng, coords.lat, applyPlaceName);
    }

    function autoGenerateRouteCode(placeName) {
        if (!placeName) return;
        const prefix = (userTerminal === 'south') ? 'ST-' : 'NT-';
        const code = prefix + placeName.split(',')[0].replace(/[^A-Za-z0-9]/g, '').substring(0, 6).toUpperCase();
        if (addEl('route_code')) addEl('route_code').value = code;
    }

    function addStop(coords) {
        if (!isPointInAllowedArea(coords.lng, coords.lat)) {
            const tname = userTerminal === 'south' ? 'Southern Cebu' : 'Northern Cebu';
            showToast('Pathway stop must be in ' + tname + '.', 'error');
            return;
        }
        getPlaceName(coords.lng, coords.lat, (placeName) => {
            const stop = { lng: coords.lng, lat: coords.lat, name: placeName };
            stops.push(stop);
            const m = new mapboxgl.Marker({ color: 'blue' })
                .setLngLat([coords.lng, coords.lat])
                .setPopup(new mapboxgl.Popup().setText('Pathway Stop: ' + placeName))
                .addTo(routeMap);
            stopMarkers.push(m);
            updateStopsList();
            calculateRouteWithStops();
        });
    }

    function updateStopsList() {
        const isView = activeFormMode === 'view';
        const stopsList = isView ? viewEl('stopsList') : addEl('stopsList');
        const stopsDataEl = isView ? viewEl('stops_data') : addEl('stops_data');
        if (!stopsList) return;
        stopsList.innerHTML = '';
        stops.forEach((stop, idx) => {
            const removeBtn = isView ? '' :
                '<button type="button" class="btn btn-sm btn-danger" onclick="removeStop(' + idx + ')" '
                + 'style="width:32px;height:32px;padding:0;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:8px;">'
                + '<i class="fas fa-times"></i></button>';
            stopsList.innerHTML +=
                '<div class="d-flex align-items-center justify-content-between mb-2 p-2 bg-light rounded">'
                + '<div class="d-flex align-items-center gap-2" style="flex:1;min-width:0;">'
                + '<span class="badge bg-primary">' + (idx + 1) + '</span>'
                + '<span class="text-dark text-truncate">' + (stop.name || '') + '</span>'
                + '</div>' + removeBtn + '</div>';
        });
        if (stopsDataEl) stopsDataEl.value = JSON.stringify(stops);
    }

    function calculateRouteWithStops() {
        if (!endMarker) return;
        const terminal = currentTerminal || TERMINALS.north;
        const coords = [terminal.coordinates];
        stops.forEach((s) => coords.push([s.lng, s.lat]));
        coords.push([endMarker.getLngLat().lng, endMarker.getLngLat().lat]);

        const url = 'https://api.mapbox.com/directions/v5/mapbox/driving/'
            + coords.map((c) => c.join(',')).join(';')
            + '?geometries=geojson&steps=true&overview=full&access_token=' + mapboxgl.accessToken;

        fetch(url)
            .then((r) => { if (!r.ok) throw new Error('Mapbox ' + r.status); return r.json(); })
            .then((data) => {
                if (!data.routes?.length) {
                    showToast('Unable to calculate route with pathway.', 'error');
                    return;
                }
                const route = data.routes[0];
                if (addEl('distance_km')) addEl('distance_km').value = (route.distance / 1000).toFixed(1);
                if (addEl('estimated_duration')) addEl('estimated_duration').value = Math.round(route.duration / 60);
                if (addEl('geometry')) addEl('geometry').value = JSON.stringify(route.geometry);
                setTimeout(calculateFare, 100);

                drawRoute(route.geometry);

                const bounds = new mapboxgl.LngLatBounds();
                route.geometry.coordinates.forEach((c) => bounds.extend(c));
                routeMap.fitBounds(bounds, { padding: { top: 50, bottom: 50, left: 50, right: 50 } });
            })
            .catch((err) => {
                console.error('Route calc failed:', err);
                showToast('Error calculating route.', 'error');
            });
    }

    function calculateFare() {
        const distance = parseFloat(addEl('distance_km')?.value) || 0;
        const busType = addEl('bus_type')?.value;
        const fareInput = addEl('route_fare');
        if (!fareInput || distance === 0) return;

        let fare;
        if (busType === 'aircon') {
            fare = distance <= 5 ? 15 : 15 + (distance - 5) * 2.65;
        } else {
            fare = distance <= 5 ? 13 : 13 + (distance - 5) * 2.25;
        }
        fare = Math.ceil(fare * 4) / 4;
        fareInput.value = fare.toFixed(2);
    }

    function clearEndPoint() {
        if (endMarker) { endMarker.remove(); endMarker = null; }
        clearStops();
        const btn = addEl('addStopBtn');
        if (btn) {
            isAddingStop = false;
            btn.classList.remove('btn-success');
            btn.classList.add('btn-outline-success');
            btn.innerHTML = '<i class="fas fa-map-pin me-1"></i>Add Pathway';
        }
        if (routeMap) {
            if (routeMap.getLayer('route')) routeMap.removeLayer('route');
            if (routeMap.getSource('route')) routeMap.removeSource('route');
        }
        ['end_location', 'end_coordinates', 'distance_km', 'estimated_duration', 'route_fare', 'geometry']
            .forEach((id) => { if (addEl(id)) addEl(id).value = ''; });
    }

    function clearStops() {
        stopMarkers.forEach((m) => { try { m.remove(); } catch (_) {} });
        stopMarkers = [];
        stops = [];
        updateStopsList();
    }

    function centerMapToCebu() {
        if (!routeMap) return;
        routeMap.flyTo({ center: (currentTerminal || TERMINALS.north).coordinates, zoom: CEBU_COORDINATES.zoom });
    }

    function getSearchBoundsParam() {
        const b = getCurrentBoundary();
        return [b.swLng, b.swLat, b.neLng, b.neLat].join(',');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function clearDestinationSearchResults() {
        destinationSearchRequestId += 1;
        const results = addEl('geocodingResults');
        if (!results) return;
        results.innerHTML = '';
        results.style.display = 'none';
    }

    function renderDestinationSearchResults(features) {
        const results = addEl('geocodingResults');
        if (!results) return;
        results.innerHTML = '';

        if (!features.length) {
            results.innerHTML = '<div class="list-group-item text-muted small">No Cebu destinations found.</div>';
            results.style.display = 'block';
            return;
        }

        features.forEach((feature) => {
            const coords = feature?.center;
            if (!Array.isArray(coords) || coords.length < 2) return;

            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'list-group-item list-group-item-action';
            item.innerHTML = '<div class="fw-semibold">' + escapeHtml(feature.text || feature.place_name || 'Destination') + '</div>'
                + '<div class="small text-muted">' + escapeHtml(feature.place_name || '') + '</div>';
            item.addEventListener('mousedown', (e) => e.preventDefault());
            item.addEventListener('click', () => {
                clearDestinationSearchResults();
                const input = addEl('destinationSearch');
                const placeName = feature.place_name || feature.text || '';
                const lng = Number(coords[0]);
                const lat = Number(coords[1]);
                if (input) input.value = placeName;
                if (routeMap) routeMap.flyTo({ center: [lng, lat], zoom: 12, duration: 600 });
                setEndPoint({ lng, lat }, placeName);
            });
            results.appendChild(item);
        });

        results.style.display = results.children.length ? 'block' : 'none';
    }

    async function searchDestinations(query) {
        const requestId = ++destinationSearchRequestId;
        if (!query || query.trim().length < 2 || !window.mapboxgl?.accessToken) {
            clearDestinationSearchResults();
            return;
        }

        const terminal = currentTerminal || TERMINALS.north;
        const params = new URLSearchParams({
            access_token: mapboxgl.accessToken,
            autocomplete: 'true',
            country: 'ph',
            language: 'en',
            limit: '8',
            proximity: terminal.coordinates.join(','),
            bbox: getSearchBoundsParam(),
            types: 'place,locality,neighborhood,address,poi',
        });

        try {
            const res = await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'
                + encodeURIComponent(query.trim()) + '.json?' + params.toString());
            if (!res.ok) throw new Error('Mapbox geocoding ' + res.status);
            const data = await res.json();
            if (requestId !== destinationSearchRequestId) return;
            const features = (data.features || []).filter((feature) => {
                const coords = feature?.center;
                return Array.isArray(coords)
                    && coords.length >= 2
                    && isPointInAllowedArea(Number(coords[0]), Number(coords[1]));
            });
            renderDestinationSearchResults(features);
        } catch (err) {
            if (requestId !== destinationSearchRequestId) return;
            console.error('Destination search failed:', err);
            const results = addEl('geocodingResults');
            if (results) {
                results.innerHTML = '<div class="list-group-item text-danger small">Unable to load destination suggestions.</div>';
                results.style.display = 'block';
            }
        }
    }

    function getPlaceName(lng, lat, cb) {
        fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/' + lng + ',' + lat + '.json?access_token=' + mapboxgl.accessToken)
            .then((r) => r.json())
            .then((data) => cb(data.features?.[0]?.place_name || (lng + ',' + lat)))
            .catch(() => cb(lng + ',' + lat));
    }

    // ---------------- form lifecycle ----------------

    function hideRouteForm() {
        const section = addSection();
        if (section) section.style.display = 'none';
        const form = addEl('routeForm');
        if (form) form.reset();
        clearDestinationSearchResults();
        destroyMap();
        stops = [];
        isAddingStop = false;
        setPathwayControlsVisible(false);
        if (activeFormMode === 'add') activeFormMode = null;
    }

    function hideViewRouteForm() {
        const section = viewSection();
        if (section) section.style.display = 'none';
        const form = document.getElementById('viewRouteForm');
        if (form) form.reset();
        destroyMap();
        stops = [];
        if (activeFormMode === 'view') activeFormMode = null;
    }

    function showAddRouteForm(options) {
        options = options || {};
        activeFormMode = 'add';
        hideViewRouteForm();

        setTerminal(getSelectedTerminalKey(), { flyTo: false, skipBoundary: true, updateStartFields: true });

        const form = addEl('routeForm');
        if (form) form.reset();
        if (addEl('route_id')) addEl('route_id').value = '';
        if (addEl('method_field')) addEl('method_field').value = '';

        const terminal = currentTerminal || TERMINALS.north;
        if (addEl('start_location')) addEl('start_location').value = terminal.name;
        if (addEl('start_coordinates')) addEl('start_coordinates').value = terminal.coordinates[0] + ',' + terminal.coordinates[1];

        const title = addEl('formTitle');
        if (title) title.innerHTML = '<i class="fas fa-route me-2"></i>Add New Route';
        const saveBtn = addEl('saveRouteBtn');
        if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Route';

        clearValidationErrors();
        clearDestinationSearchResults();
        endMarker = null;
        clearStops();

        // Pathway controls are available in both Add and Edit modes so the
        // sysadmin can drop stops along the route as it is being created.
        setPathwayControlsVisible(true);

        const section = addSection();
        if (section) {
            section.style.display = 'block';
            section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        if (!options.skipMapInit) {
            whenContainerReady('routeMap', () => {
                initializeMap({
                    mode: 'add',
                    readOnly: false,
                    onReady: () => {
                        showToast('Click on the highlighted blue area to set destination from ' + terminal.name, 'info');
                    },
                });
                if (addEl('geometry')) addEl('geometry').value = '';
                if (addEl('stops_data')) addEl('stops_data').value = '[]';
            });
        }
    }

    function viewRoute(id) {
        fetch('/api/routes/' + id)
            .then((r) => r.json())
            .then((data) => {
                if (!data.success || !data.route) {
                    showToast('Failed to load route details', 'error');
                    return;
                }

                activeFormMode = 'view';
                hideRouteForm();

                const r = data.route;
                const section = viewSection();

                if (viewEl('route_id')) viewEl('route_id').value = r.id;
                if (viewEl('route_code')) viewEl('route_code').value = r.code || '';
                if (viewEl('route_name')) viewEl('route_name').value = r.name || '';
                if (viewEl('start_location')) viewEl('start_location').value = r.start_location || '';
                if (viewEl('end_location')) viewEl('end_location').value = r.end_location || '';
                if (viewEl('start_coordinates')) viewEl('start_coordinates').value = r.start_coordinates || '';
                if (viewEl('end_coordinates')) viewEl('end_coordinates').value = r.end_coordinates || '';
                if (viewEl('distance_km')) viewEl('distance_km').value = r.distance_km || '';
                if (viewEl('estimated_duration')) viewEl('estimated_duration').value = r.estimated_duration || '';
                if (viewEl('route_fare')) viewEl('route_fare').value = r.route_fare || '';
                if (viewEl('route_status')) viewEl('route_status').value = r.status === 'active' ? 'Active' : 'Inactive';
                if (viewEl('bus_type')) viewEl('bus_type').value = r.bus_type === 'aircon' ? 'Air-Con' : 'Regular';
                if (viewEl('description')) viewEl('description').value = r.description || '';
                if (viewEl('geometry')) viewEl('geometry').value = geometryToFormString(r.geometry);

                const returnTripInfo = viewEl('returnTripInfo');
                const returnTripInfoText = viewEl('returnTripInfoText');
                if (returnTripInfoText) {
                    if (r.has_return_trip) {
                        if (returnTripInfo) returnTripInfo.className = 'alert alert-success mb-0 py-2 d-flex align-items-center gap-2';
                        returnTripInfoText.textContent = 'Return trip data is stored in this route record.';
                    } else {
                        if (returnTripInfo) returnTripInfo.className = 'alert alert-info mb-0 py-2 d-flex align-items-center gap-2';
                        returnTripInfoText.textContent = 'No return trip geometry stored for this route.';
                    }
                }

                stops = r.stops_data || [];
                if (viewEl('stops_data')) viewEl('stops_data').value = JSON.stringify(stops);

                if (r.terminal && TERMINALS[r.terminal]) {
                    userTerminal = r.terminal;
                    currentTerminal = TERMINALS[r.terminal];
                    const label = document.getElementById('view_terminal_label');
                    if (label) label.textContent = r.terminal.charAt(0).toUpperCase() + r.terminal.slice(1) + ' Bus Terminal';
                }

                if (section) {
                    section.style.display = 'block';
                    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }

                whenContainerReady('viewRouteMap', () => {
                    initializeMap({
                        mode: 'view',
                        readOnly: true,
                        onReady: async () => {
                            if (!routeMap) return;
                            updateStopsList();
                            await renderSavedPath(r);
                            // Markers reposition automatically as the camera
                            // moves, so no need to wait for an idle event.
                            placeMarkersForRoute(r);
                            // Belt-and-suspenders: if fitBounds is still
                            // animating, re-stamp markers after it settles.
                            setTimeout(() => routeMap && placeMarkersForRoute(r), 300);
                        },
                    });
                });
            })
            .catch((err) => {
                console.error('viewRoute failed:', err);
                showToast('Failed to load route details', 'error');
            });
    }

    function editRoute(id) {
        fetch('/api/routes/' + id)
            .then((r) => r.json())
            .then((data) => {
                if (!data.success || !data.route) {
                    showToast('Failed to load route details', 'error');
                    return;
                }
                showAddRouteForm({ skipMapInit: true });
                const r = data.route;

                if (r.terminal) setTerminal(r.terminal, { flyTo: false, skipBoundary: true });

                const title = addEl('formTitle');
                if (title) title.innerHTML = '<i class="fas fa-edit me-2"></i>Edit Route';
                const saveBtn = addEl('saveRouteBtn');
                if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Update Route';

                if (addEl('route_id')) addEl('route_id').value = r.id;
                if (addEl('route_code')) addEl('route_code').value = r.code || '';
                if (addEl('route_name')) addEl('route_name').value = r.name || '';
                if (addEl('start_location')) addEl('start_location').value = r.start_location || '';
                if (addEl('end_location')) addEl('end_location').value = r.end_location || '';
                if (addEl('start_coordinates')) addEl('start_coordinates').value = r.start_coordinates || '';
                if (addEl('end_coordinates')) addEl('end_coordinates').value = r.end_coordinates || '';
                if (addEl('distance_km')) addEl('distance_km').value = r.distance_km || '';
                if (addEl('estimated_duration')) addEl('estimated_duration').value = r.estimated_duration || '';
                if (addEl('route_fare')) addEl('route_fare').value = r.route_fare || '';
                if (addEl('route_status')) addEl('route_status').value = r.status || 'active';
                if (addEl('bus_type')) addEl('bus_type').value = r.bus_type || 'regular';
                if (addEl('description')) addEl('description').value = r.description || '';
                if (addEl('geometry')) addEl('geometry').value = geometryToFormString(r.geometry);
                stops = r.stops_data || [];
                if (addEl('stops_data')) addEl('stops_data').value = JSON.stringify(stops);

                whenContainerReady('routeMap', () => {
                    initializeMap({
                        mode: 'add',
                        readOnly: false,
                        onReady: async () => {
                            if (!routeMap) return;
                            updateStopsList();
                            const line = normalizeLineStringGeometry(r.geometry);
                            if (line) {
                                drawRoute(line);
                                fitMapToLine(line);
                            } else {
                                calculateRouteWithStops();
                            }
                            placeMarkersForRoute(r, { showStops: true });
                            setTimeout(() => routeMap && placeMarkersForRoute(r, { showStops: true }), 300);
                        },
                    });
                });
            })
            .catch((err) => {
                console.error('editRoute failed:', err);
                showToast('Failed to load route details', 'error');
            });
    }

    // ---------------- delete ----------------

    function showBootstrapModal(modalId) {
        const el = document.getElementById(modalId);
        if (!el) return;
        if (typeof window.bootstrap !== 'undefined') {
            (window.bootstrap.Modal.getInstance(el) || new window.bootstrap.Modal(el)).show();
        } else {
            el.classList.add('show');
            el.style.display = 'block';
            document.body.classList.add('modal-open');
        }
    }

    function hideBootstrapModal(modalId) {
        const el = document.getElementById(modalId);
        if (!el) return;
        if (typeof window.bootstrap !== 'undefined') {
            window.bootstrap.Modal.getInstance(el)?.hide();
        } else {
            el.classList.remove('show');
            el.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    }

    function deleteRoute(id, routeName) {
        routeToDelete = id;
        const nameEl = document.getElementById('deleteRouteModalRouteName');
        if (nameEl) {
            nameEl.textContent = routeName ? 'Route: ' + routeName : '';
            nameEl.style.display = routeName ? 'block' : 'none';
        }
        showBootstrapModal('deleteRouteModal');
    }

    function performDeleteRoute() {
        if (!routeToDelete) return;
        const id = routeToDelete;
        fetch('/routes/' + id, {
            method: 'DELETE',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                'Accept': 'application/json',
            },
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.success) {
                    showToast('Route deleted successfully', 'success');
                    setTimeout(() => window.location.reload(), 800);
                } else {
                    showToast(data.message || 'Failed to delete route', 'error');
                }
            })
            .catch((err) => {
                console.error('delete failed:', err);
                showToast('Failed to delete route', 'error');
            })
            .finally(() => {
                routeToDelete = null;
                hideBootstrapModal('deleteRouteModal');
            });
    }

    // ---------------- save handler ----------------

    function attachFormHandlers() {
        const form = document.getElementById('routeForm');
        if (form) {
            form.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
                    e.preventDefault();
                }
            });

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!addEl('end_location')?.value) {
                    showToast('Please select a destination on the map.', 'error');
                    return;
                }
                if (!addEl('geometry')?.value) {
                    showToast('Please calculate the route first by clicking on the map.', 'error');
                    return;
                }
                if (!addEl('end_coordinates')?.value?.trim()) {
                    showToast('End coordinates are missing. Re-select the destination.', 'error');
                    return;
                }
                if (!addEl('distance_km')?.value?.trim() || !addEl('estimated_duration')?.value?.trim()) {
                    showToast('Wait for route to finish loading, then try again.', 'error');
                    return;
                }

                const fd = new FormData(form);
                const terminal = currentTerminal || TERMINALS.north;
                fd.set('terminal', getSelectedTerminalKey());
                fd.set('start_location', terminal.name);
                fd.set('start_coordinates', terminal.coordinates[0] + ',' + terminal.coordinates[1]);
                fd.set('stops_data', JSON.stringify(stops));
                fd.set('geometry', addEl('geometry').value);

                const saveBtn = addEl('saveRouteBtn');
                const original = saveBtn?.innerHTML;
                const routeId = addEl('route_id')?.value || '';
                const isEdit = routeId !== '';

                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
                }

                const url = isEdit ? '/routes/' + routeId : '/routes';
                if (isEdit) fd.append('_method', 'PUT');

                fetch(url, {
                    method: 'POST',
                    body: fd,
                    headers: {
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                        'Accept': 'application/json',
                    },
                })
                    .then((res) => {
                        if (!res.ok) return res.json().then((err) => Promise.reject(err));
                        return res.json();
                    })
                    .then((data) => {
                        if (data?.success) {
                            showToast(data.message || 'Route saved', 'success');
                            hideRouteForm();
                            setTimeout(() => window.location.reload(), 500);
                        } else if (data?.errors) {
                            showValidationErrors(data.errors);
                            showToast('Please fix the errors in the form.', 'error');
                        } else {
                            showToast(data?.message || 'Unknown error', 'error');
                        }
                    })
                    .catch((err) => {
                        if (err?.errors) {
                            showValidationErrors(err.errors);
                            showToast('Please fix the errors in the form.', 'error');
                        } else {
                            showToast(err?.message || 'Error saving route', 'error');
                        }
                    })
                    .finally(() => {
                        if (saveBtn) {
                            saveBtn.disabled = false;
                            saveBtn.innerHTML = original;
                        }
                    });
            });
        }

        const viewForm = document.getElementById('viewRouteForm');
        if (viewForm) {
            viewForm.addEventListener('submit', (e) => e.preventDefault());
            viewForm.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
        }

        const addStopBtn = addSection()?.querySelector('#addStopBtn');
        if (addStopBtn) {
            const fresh = addStopBtn.cloneNode(true);
            addStopBtn.parentNode.replaceChild(fresh, addStopBtn);
            fresh.addEventListener('click', function (e) {
                e.preventDefault();
                if (!endMarker) {
                    showToast('Please select a destination first.', 'error');
                    return;
                }
                isAddingStop = !isAddingStop;
                if (isAddingStop) {
                    this.classList.remove('btn-outline-success');
                    this.classList.add('btn-success');
                    this.innerHTML = '<i class="fas fa-map-pin me-1"></i>Click on map to add pathway';
                } else {
                    this.classList.remove('btn-success');
                    this.classList.add('btn-outline-success');
                    this.innerHTML = '<i class="fas fa-map-pin me-1"></i>Add Pathway';
                }
            });
        }

        const busTypeSelect = addSection()?.querySelector('#bus_type');
        if (busTypeSelect) {
            busTypeSelect.addEventListener('change', () => {
                if (addEl('distance_km')?.value) calculateFare();
            });
        }

        const destinationSearch = addSection()?.querySelector('#destinationSearch');
        if (destinationSearch) {
            let destinationSearchTimer = null;
            destinationSearch.addEventListener('input', () => {
                clearTimeout(destinationSearchTimer);
                const query = destinationSearch.value.trim();
                destinationSearchTimer = setTimeout(() => searchDestinations(query), 250);
            });
            destinationSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') clearDestinationSearchResults();
            });
            destinationSearch.addEventListener('blur', () => {
                setTimeout(clearDestinationSearchResults, 200);
            });
        }

        const confirmBtn = document.getElementById('confirmDeleteRouteBtn');
        if (confirmBtn) confirmBtn.addEventListener('click', performDeleteRoute);
        const cancelBtn = document.getElementById('cancelDeleteRouteBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => (routeToDelete = null));
        const deleteModal = document.getElementById('deleteRouteModal');
        if (deleteModal) deleteModal.addEventListener('hidden.bs.modal', () => (routeToDelete = null));
    }

    // ---------------- bootstrap ----------------

    document.addEventListener('DOMContentLoaded', function () {
        const terminalSelect = document.getElementById('route_terminal_select');
        if (terminalSelect) {
            setTerminal(terminalSelect.value || 'north', { flyTo: false, skipBoundary: true });
            terminalSelect.addEventListener('change', function () {
                clearDestinationSearchResults();
                setTerminal(this.value, { flyTo: true });
                if (endMarker) {
                    const c = endMarker.getLngLat();
                    if (!isPointInAllowedArea(c.lng, c.lat)) {
                        clearEndPoint();
                        showToast('Destination cleared — outside the selected terminal area.', 'info');
                    } else {
                        calculateRouteWithStops();
                    }
                }
            });
        }

        attachFormHandlers();
    });

    // ---------------- public API ----------------

    window.showAddRouteForm = showAddRouteForm;
    window.hideRouteForm = hideRouteForm;
    window.hideViewRouteForm = hideViewRouteForm;
    window.clearEndPoint = clearEndPoint;
    window.centerMapToCebu = centerMapToCebu;
    window.clearStops = clearStops;
    window.calculateFare = calculateFare;
    window.viewRoute = viewRoute;
    window.editRoute = editRoute;
    window.deleteRoute = deleteRoute;
    window.removeStop = function (idx) {
        if (stopMarkers[idx]) stopMarkers[idx].remove();
        stops.splice(idx, 1);
        stopMarkers.splice(idx, 1);
        updateStopsList();
        calculateRouteWithStops();
    };
})();
