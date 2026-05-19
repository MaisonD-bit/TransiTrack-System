let routeMap;
let startMarker, endMarker;
let routeLayer;
let stopMarkers = [];
let stops = [];
let isAddingStop = false;

const CEBU_COORDINATES = {
    center: [123.8854, 10.3157],
    zoom: 12
};

const CEBU_NORTH_TERMINAL = {
    coordinates: [123.920994, 10.311008],
    name: "Cebu North Bus Terminal (SM City)"
};

const TERMINALS = {
    north: {
        coordinates: [123.920994, 10.311008],
        name: "Cebu North Bus Terminal (SM City)"
    },
    south: {
        coordinates: [123.893356, 10.298361],
        name: "Cebu South Bus Terminal"
    }
};

/**
 * Route.geometry from API may be a LineString object, a Feature, a JSON string,
 * or double-encoded JSON. Returns a LineString geometry for drawRoute(), or null.
 */
function parseRouteLineStringGeometry(geometry) {
    if (geometry == null) return null;

    let g = geometry;
    if (typeof g === 'string') {
        const t = g.trim();
        if (!t) return null;
        try {
            g = JSON.parse(t);
        } catch {
            return null;
        }
    }
    while (typeof g === 'string') {
        try {
            g = JSON.parse(g);
        } catch {
            return null;
        }
    }
    if (!g || typeof g !== 'object') return null;

    if (g.type === 'Feature' && g.geometry && g.geometry.type === 'LineString' && Array.isArray(g.geometry.coordinates)) {
        return g.geometry;
    }
    if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
        return g;
    }
    if (Array.isArray(g.coordinates) && g.coordinates.length > 0) {
        return { type: 'LineString', coordinates: g.coordinates };
    }
    if (g.type === 'FeatureCollection' && Array.isArray(g.features) && g.features[0]?.geometry) {
        return parseRouteLineStringGeometry(g.features[0].geometry);
    }
    return null;
}

/** Normalize coords to numeric [lng, lat] pairs (Mapbox order). */
function normalizeLineStringGeometry(geometry) {
    const raw = parseRouteLineStringGeometry(geometry);
    if (!raw || !Array.isArray(raw.coordinates)) return null;

    const coords = raw.coordinates
        .map((c) => {
            if (!c || c.length < 2) return null;
            let lng = typeof c[0] === 'string' ? parseFloat(c[0]) : Number(c[0]);
            let lat = typeof c[1] === 'string' ? parseFloat(c[1]) : Number(c[1]);
            if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
            // Philippines: lng ~ 100–140, lat ~ 5–20 — fix [lat,lng] if swapped
            if (Math.abs(lng) <= 90 && Math.abs(lat) > 90) {
                [lng, lat] = [lat, lng];
            }
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
    if (Math.abs(lng) <= 90 && Math.abs(lat) > 90) {
        [lng, lat] = [lat, lng];
    }
    return [lng, lat];
}

function buildWaypointsFromRoute(route) {
    const pts = [];
    const terminal = currentTerminal || TERMINALS.north;
    const start = parseCoordPair(route.start_coordinates) || terminal.coordinates;
    pts.push(start);

    (route.stops_data || []).forEach((stop) => {
        const lng = stop.lng != null ? Number(stop.lng) : NaN;
        const lat = stop.lat != null ? Number(stop.lat) : NaN;
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
            pts.push([lng, lat]);
        }
    });

    const end = parseCoordPair(route.end_coordinates);
    if (end) {
        pts.push(end);
    }
    return pts;
}

async function fetchDrivingRouteGeometry(waypoints) {
    if (!waypoints || waypoints.length < 2 || !mapboxgl.accessToken) return null;
    const coordsStr = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
    try {
        const res = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (data.routes?.[0]?.geometry) {
            return normalizeLineStringGeometry(data.routes[0].geometry);
        }
    } catch (e) {
        console.warn('fetchDrivingRouteGeometry failed:', e);
    }
    return null;
}

function fitMapToLineString(geoJson) {
    if (!routeMap || !geoJson?.coordinates?.length) return;
    const bounds = new mapboxgl.LngLatBounds();
    geoJson.coordinates.forEach((coord) => bounds.extend(coord));
    routeMap.fitBounds(bounds, { padding: 50, maxZoom: 14 });
}

async function renderViewRoutePath(route) {
    // Prefer saved driving geometry (same as legacy editRoute flow)
    let geoJson = normalizeLineStringGeometry(route.geometry);

    if (!geoJson) {
        const waypoints = buildWaypointsFromRoute(route);
        if (waypoints.length >= 2) {
            geoJson = await fetchDrivingRouteGeometry(waypoints);
        }
    }

    if (!geoJson || !routeMap) {
        const waypoints = buildWaypointsFromRoute(route);
        if (waypoints.length >= 2) {
            showToast('Could not load route pathway. Check Mapbox token or network.', 'warning');
        }
        return;
    }

    drawRoute(geoJson);
    fitMapToLineString(geoJson);
    requestAnimationFrame(() => routeMap?.resize());
}

function geometryToFormString(geometry) {
    if (geometry == null) return '';
    if (typeof geometry === 'string') return geometry;
    try {
        return JSON.stringify(geometry);
    } catch {
        return '';
    }
}

let userTerminal = null;
let currentTerminal = null;
/** @type {'add'|'view'|null} */
let activeFormMode = null;

function addSection() {
    return document.getElementById('routeFormSection');
}

function viewSection() {
    return document.getElementById('viewRouteFormSection');
}

function addEl(id) {
    const root = addSection();
    if (!root) return null;
    if (id === 'formTitle') {
        return document.getElementById('add_formTitle');
    }
    return root.querySelector('#' + id);
}

function viewEl(id) {
    const root = viewSection();
    if (!root) return null;
    const resolved = {
        formTitle: 'view_formTitle',
        routeMap: 'viewRouteMap',
        stopsList: 'view_stopsList',
    }[id] || (id.startsWith('view_') ? id : `view_${id}`);
    return root.querySelector(`#${resolved}`) || document.getElementById(resolved);
}

const TERMINAL_BOUNDARIES = {
    north: {
        swLng: 123.6,
        swLat: 10.280000,
        neLng: 124.10,
        neLat: 11.30
    },
    south: {
        swLng: 123.25,      
        swLat: 9.50,      
        neLng: 123.95,      
        neLat: 10.35        
    }
};

function getCurrentBoundary() {
    const terminal = userTerminal || 'north';
    return TERMINAL_BOUNDARIES[terminal];
}

//   FIXED: Correct boundary check function
function isPointInAllowedArea(lng, lat) {
    const boundary = getCurrentBoundary();
    return (
        lng >= boundary.swLng &&
        lng <= boundary.neLng &&
        lat >= boundary.swLat &&
        lat <= boundary.neLat
    );
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `position-fixed top-0 end-0 m-3 alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show`;
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

function clearValidationErrors() {
    const root = addSection();
    if (!root) return;
    root.querySelectorAll('.form-control, .form-select').forEach(input => {
        input.classList.remove('is-invalid');
    });
    root.querySelectorAll('.invalid-feedback').forEach(div => {
        div.textContent = '';
    });
}

function showValidationErrors(errors) {
    clearValidationErrors();
    const root = addSection();
    if (!root) return;
    for (const [field, messages] of Object.entries(errors)) {
        const inputId = field === 'code' ? 'route_code' : field === 'name' ? 'route_name' : field === 'status' ? 'route_status' : field;
        const input = root.querySelector(`#${inputId}`);
        const errorDiv = root.querySelector(`#${field}_error`);
        if (input && errorDiv) {
            input.classList.add('is-invalid');
            errorDiv.textContent = messages[0];
        }
    }
}

//   FIXED: Proper map initialization with boundary
function initializeMap(options = {}) {
    const mode = options.mode || activeFormMode || 'add';
    const readOnly = options.readOnly === true || mode === 'view';
    const containerId = mode === 'view' ? 'viewRouteMap' : 'routeMap';
    const onLoad = typeof options.onLoad === 'function' ? options.onLoad : null;

    if (routeMap) {
        routeMap.remove();
        routeMap = null;
    }
    
    // ✅ Use current terminal or default to north
    const terminal = currentTerminal || TERMINALS.north;
    
    routeMap = new mapboxgl.Map({
        container: containerId,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: terminal.coordinates, // ✅ Center on user's terminal
        zoom: CEBU_COORDINATES.zoom
    });
    
    routeMap.addControl(new mapboxgl.NavigationControl());

    // ✅ Place start marker at user's terminal
    startMarker = new mapboxgl.Marker({ color: 'green' })
        .setLngLat(terminal.coordinates)
        .addTo(routeMap);

    const setupBoundaryAndReady = function() {
        // View mode: no terminal bounding box — only the solid blue route line + markers.
        // The dashed rectangle was the operating-area boundary, not the pathway.
        if (!readOnly) {
            const boundary = getCurrentBoundary();

            const cebuPolygon = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [boundary.swLng, boundary.swLat],
                        [boundary.neLng, boundary.swLat],
                        [boundary.neLng, boundary.neLat],
                        [boundary.swLng, boundary.neLat],
                        [boundary.swLng, boundary.swLat]
                    ]]
                }
            };

            routeMap.addSource('cebu-boundary', {
                type: 'geojson',
                data: cebuPolygon
            });

            routeMap.addLayer({
                id: 'cebu-fill',
                type: 'fill',
                source: 'cebu-boundary',
                paint: {
                    'fill-color': '#0080ff',
                    'fill-opacity': 0.15
                }
            });

            routeMap.addLayer({
                id: 'cebu-border',
                type: 'line',
                source: 'cebu-boundary',
                paint: {
                    'line-color': '#0080ff',
                    'line-width': 2,
                    'line-dasharray': [2, 2]
                }
            });
        }

        if (onLoad) {
            onLoad(routeMap);
        }
    };

    if (routeMap.loaded()) {
        setupBoundaryAndReady();
    } else {
        routeMap.once('load', setupBoundaryAndReady);
    }

    if (!readOnly) {
        routeMap.on('click', function(e) {
            if (isAddingStop) {
                addStop(e.lngLat);
            } else if (!endMarker) {
                setEndPoint(e.lngLat);
            }
        });
    }
}

function setEndPoint(coords) {
    if (!isPointInAllowedArea(coords.lng, coords.lat)) {
        const terminalName = (userTerminal === 'south') ? 'Southern Cebu' : 'Northern Cebu';
        showToast(`Destination must be in ${terminalName}. Please select a location within the highlighted blue area.`, 'error');
        return;
    }

    if (endMarker) {
        endMarker.remove();
    }
    endMarker = new mapboxgl.Marker({ color: 'red' })
        .setLngLat(coords)
        .addTo(routeMap);

    getPlaceName(coords.lng, coords.lat, function(placeName) {
        if (addEl('end_location')) addEl('end_location').value = placeName;
        if (addEl('end_coordinates')) addEl('end_coordinates').value = `${coords.lng},${coords.lat}`;
        autoGenerateRouteCode(placeName);
        showToast('Destination set! You can now add pathway or save route.', 'success');
        calculateRouteWithStops();
    });
}

function autoGenerateRouteCode(placeName) {
    if (!placeName) return;
    let code = 'NT-' + placeName.split(',')[0].replace(/[^A-Za-z0-9]/g, '').substring(0, 6).toUpperCase();
    if (addEl('route_code')) addEl('route_code').value = code;
}

function addStop(coords) {
    console.log('addStop called with coords:', coords);
    console.log('isAddingStop:', isAddingStop);
    
    // Validate stop is within boundary
    if (!isPointInAllowedArea(coords.lng, coords.lat)) {
        const terminalName = (userTerminal === 'south') ? 'Southern Cebu' : 'Northern Cebu';
        showToast(`Pathway stop must be in ${terminalName}. Please select a location within the highlighted blue area.`, 'error');
        return;
    }

    // Prevent adding stop if near the current route line
    if (window.lastRouteGeometry && isPointNearLine(coords, window.lastRouteGeometry.coordinates)) {
        showToast('Pathway stop is too close to the existing route. Please select a different location.', 'warning');
        return;
    }
    
    getPlaceName(coords.lng, coords.lat, function(placeName) {
        const stop = {
            lng: coords.lng,
            lat: coords.lat,
            name: placeName
        };
        stops.push(stop);
        console.log('Pathway stop added:', stop);
        console.log('Total pathway stops:', stops.length);
        
        const marker = new mapboxgl.Marker({ color: 'blue' })
            .setLngLat([coords.lng, coords.lat])
            .setPopup(new mapboxgl.Popup().setText(`Pathway Stop: ${placeName}`))
            .addTo(routeMap);
        stopMarkers.push(marker);
        updateStopsList();
        calculateRouteWithStops();
        showToast(`Pathway stop added: ${placeName}`, 'success');
    });
}

function updateStopsList() {
    const isView = activeFormMode === 'view';
    const stopsList = isView ? viewEl('stopsList') : addEl('stopsList');
    const stopsDataEl = isView ? viewEl('stops_data') : addEl('stops_data');
    if (!stopsList) return;
    stopsList.innerHTML = '';
    stops.forEach((stop, idx) => {
        const removeBtn = isView ? '' : `
                <button 
                    type="button" 
                    class="btn btn-sm btn-danger" 
                    onclick="removeStop(${idx})" 
                    title="Remove pathway stop"
                    style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-left: 8px;"
                >
                    <i class="fas fa-times"></i>
                </button>`;
        stopsList.innerHTML += `
            <div class="d-flex align-items-center justify-content-between mb-2 p-2 bg-light rounded">
                <div class="d-flex align-items-center gap-2" style="flex: 1; min-width: 0;">
                    <span class="badge bg-primary">${idx + 1}</span>
                    <span class="text-dark text-truncate">${stop.name}</span>
                </div>
                ${removeBtn}
            </div>
        `;
    });
    if (stopsDataEl) stopsDataEl.value = JSON.stringify(stops);
}

window.removeStop = function(idx) {
    if (stopMarkers[idx]) {
        stopMarkers[idx].remove();
    }
    stops.splice(idx, 1);
    stopMarkers.splice(idx, 1);
    updateStopsList();
    calculateRouteWithStops();
};

window.clearStops = function() {
    stopMarkers.forEach(marker => marker.remove());
    stopMarkers = [];
    stops = [];
    updateStopsList();
    calculateRouteWithStops();
};

function calculateRouteWithStops() {
    if (!endMarker) return;

    const terminal = currentTerminal || TERMINALS.north;
    let coordinates = [terminal.coordinates];
    
    stops.forEach(stop => {
        coordinates.push([stop.lng, stop.lat]);
    });
    coordinates.push([endMarker.getLngLat().lng, endMarker.getLngLat().lat]);

    let coordsStr = coordinates.map(coord => coord.join(',')).join(';');
    
    fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?geometries=geojson&steps=true&overview=full&access_token=${mapboxgl.accessToken}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const distanceKm = (route.distance / 1000);
                const durationMins = Math.round(route.duration / 60);

                const distanceInput = addEl('distance_km');
                const durationInput = addEl('estimated_duration');
                const geometryInput = addEl('geometry');

                if (distanceInput) distanceInput.value = distanceKm.toFixed(1);
                if (durationInput) durationInput.value = durationMins;
                if (geometryInput) geometryInput.value = JSON.stringify(route.geometry);

                setTimeout(() => {
                    calculateFare();
                }, 100);

                drawRoute(route.geometry);

                const bounds = route.geometry.coordinates.reduce(function (bounds, coord) {
                    return bounds.extend(coord);
                }, new mapboxgl.LngLatBounds(route.geometry.coordinates[0], route.geometry.coordinates[0]));
                
                if (routeMap) {
                    routeMap.fitBounds(bounds, { padding: { top: 50, bottom: 50, left: 50, right: 50 } });
                }
            } else {
                showToast('Unable to calculate route with pathway.', 'error');
            }
        })
        .catch(error => {
            console.error('Error calculating route:', error);
            showToast('Error calculating route. Please try again.', 'error');
        });
}

function calculateFare() {
    const distanceInput = addEl('distance_km');
    const busTypeInput = addEl('bus_type');
    const routeFareInput = addEl('route_fare');

    //   Enhanced logging
    console.log('calculateFare called');
    console.log('Distance input:', distanceInput);
    console.log('Bus type input:', busTypeInput);
    console.log('Route fare input:', routeFareInput);

    if (!distanceInput || !busTypeInput || !routeFareInput) {
        console.warn('Required inputs for fare calculation not found');
        return;
    }

    const distance = parseFloat(distanceInput.value) || 0;
    const busType = busTypeInput.value;

    console.log('Distance:', distance, 'Bus Type:', busType);

    if (distance === 0) {
        console.warn('Distance is 0, cannot calculate fare');
        return;
    }

    let fare = 0;

    if (busType === 'aircon') {
        // Air-Con: ₱15 + ₱2.65/km after 5km
        if (distance <= 5) {
            fare = 15.00;
        } else {
            fare = 15.00 + (distance - 5) * 2.65;
        }
    } else {
        // Regular: ₱13 + ₱2.25/km after 5km
        if (distance <= 5) {
            fare = 13.00;
        } else {
            fare = 13.00 + (distance - 5) * 2.25;
        }
    }

    // Round to nearest ₱0.25 (LTFRB rule)
    fare = Math.ceil(fare * 4) / 4;

    console.log('Calculated fare:', fare);

    // Update the fare input
    routeFareInput.value = fare.toFixed(2);
    
    // showToast(`Route fare calculated: ₱${fare.toFixed(2)}`, 'success');
}

function drawRoute(geometry) {
    if (!routeMap || !geometry) return;

    const lineGeom = normalizeLineStringGeometry(geometry);
    if (!lineGeom) {
        console.warn('drawRoute: could not parse LineString geometry');
        return;
    }

    const apply = () => {
        window.lastRouteGeometry = lineGeom;
        try {
            if (routeMap.getLayer('route')) {
                routeMap.removeLayer('route');
            }
            if (routeMap.getSource('route')) {
                routeMap.removeSource('route');
            }
            routeMap.addSource('route', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: lineGeom
                }
            });

            // On top of basemap — same weight as legacy routes.js (width 5)
            routeMap.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#3b82f6',
                    'line-width': 5,
                    'line-opacity': 0.9
                }
            });
        } catch (e) {
            console.error('drawRoute failed:', e);
        }
    };

    if (routeMap.isStyleLoaded()) {
        apply();
    } else {
        routeMap.once('load', apply);
    }
}

function clearEndPoint() {
    if (endMarker) {
        endMarker.remove();
        endMarker = null;
    }
    clearStops();

    const addStopBtn = addEl('addStopBtn');
    if (addStopBtn) {
        isAddingStop = false;
        addStopBtn.classList.remove('btn-success');
        addStopBtn.classList.add('btn-outline-success');
        addStopBtn.innerHTML = '<i class="fas fa-map-pin me-1"></i>Add Pathway';
    }

    if (routeMap) {
        if (routeMap.getLayer('route')) routeMap.removeLayer('route');
        if (routeMap.getSource('route')) routeMap.removeSource('route');
    }
    
    const endLocationInput = addEl('end_location');
    const endCoordinatesInput = addEl('end_coordinates');
    const distanceInput = addEl('distance_km');
    const durationInput = addEl('estimated_duration');
    const routeFareInput = addEl('route_fare');
    const geometryInput = addEl('geometry');
    
    if (endLocationInput) endLocationInput.value = '';
    if (endCoordinatesInput) endCoordinatesInput.value = '';
    if (distanceInput) distanceInput.value = '';
    if (durationInput) durationInput.value = '';
    if (routeFareInput) routeFareInput.value = '';
    if (geometryInput) geometryInput.value = '';
    
    showToast('Destination cleared. Click on map to set new destination.', 'info');
}

function centerMapToCebu() {
    if (routeMap) {
        routeMap.flyTo({
            center: (currentTerminal || TERMINALS.north).coordinates,
            zoom: CEBU_COORDINATES.zoom,
            duration: 2000
        });
        showToast('Map centered to Cebu City', 'info');
    }
}

// Form visibility functions
function showAddRouteForm() {
    activeFormMode = 'add';
    hideViewRouteForm();

    const form = addEl('routeForm');
    if (form) form.reset();
    if (addEl('route_id')) addEl('route_id').value = '';
    if (addEl('method_field')) addEl('method_field').value = '';

    const returnTripInfo = addEl('returnTripInfo');
    const returnTripInfoText = addEl('returnTripInfoText');
    if (returnTripInfo) returnTripInfo.className = 'alert alert-info mb-0 py-2 d-flex align-items-center gap-2';
    if (returnTripInfoText) returnTripInfoText.textContent = 'A return trip route will be automatically created when you save.';

    const terminal = currentTerminal || TERMINALS.north;
    if (addEl('start_location')) addEl('start_location').value = terminal.name;
    if (addEl('start_coordinates')) addEl('start_coordinates').value = `${terminal.coordinates[0]},${terminal.coordinates[1]}`;

    const title = addEl('formTitle');
    if (title) title.innerHTML = '<i class="fas fa-route me-2"></i>Add New Route';
    const saveBtn = addEl('saveRouteBtn');
    if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Route';

    clearValidationErrors();
    endMarker = null;
    clearStops();

    const section = addSection();
    if (section) {
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
    }

    setTimeout(() => {
        initializeMap({ mode: 'add', readOnly: false });
        showToast(`Click on the highlighted blue area to select destination from ${terminal.name}`, 'info');
        if (addEl('geometry')) addEl('geometry').value = '';
        if (addEl('stops_data')) addEl('stops_data').value = '[]';
    }, 100);
}

function isPointNearLine(point, lineCoords, thresholdMeters = 50) {
    function haversine(lon1, lat1, lon2, lat2) {
        const R = 6371000;
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    for (let i = 0; i < lineCoords.length - 1; i++) {
        const [lon1, lat1] = lineCoords[i];
        const [lon2, lat2] = lineCoords[i+1];
        const A = {x: lon1, y: lat1};
        const B = {x: lon2, y: lat2};
        const P = {x: point.lng, y: point.lat};
        const AB = {x: B.x - A.x, y: B.y - A.y};
        const AP = {x: P.x - A.x, y: P.y - A.y};
        const ab2 = AB.x*AB.x + AB.y*AB.y;
        const ap_ab = AP.x*AB.x + AP.y*AB.y;
        let t = ab2 === 0 ? 0 : ap_ab / ab2;
        t = Math.max(0, Math.min(1, t));
        const closest = {x: A.x + AB.x*t, y: A.y + AB.y*t};
        const dist = haversine(P.x, P.y, closest.x, closest.y);
        if (dist < thresholdMeters) return true;
    }
    return false;
}

function hideRouteForm() {
    const section = addSection();
    if (section) section.style.display = 'none';
    const form = addEl('routeForm');
    if (form) form.reset();
    if (routeMap) {
        routeMap.remove();
        routeMap = null;
    }
    startMarker = endMarker = null;
    stops = [];
    stopMarkers = [];
    isAddingStop = false;
    if (activeFormMode === 'add') activeFormMode = null;
}

function hideViewRouteForm() {
    const section = viewSection();
    if (section) section.style.display = 'none';
    const form = document.getElementById('viewRouteForm');
    if (form) form.reset();
    if (routeMap) {
        routeMap.remove();
        routeMap = null;
    }
    startMarker = endMarker = null;
    stops = [];
    stopMarkers = [];
    if (activeFormMode === 'view') activeFormMode = null;
}

document.addEventListener('DOMContentLoaded', function() {
    // ✅ TERMINAL DETECTION MUST BE FIRST!
    const terminalMeta = document.querySelector('meta[name="user-terminal"]');
    if (terminalMeta) {
        userTerminal = terminalMeta.getAttribute('content');
        currentTerminal = TERMINALS[userTerminal];
        console.log('🚨 USER TERMINAL LOADED:', userTerminal, currentTerminal);
    } else {
        console.error('❌ NO TERMINAL META TAG FOUND!');
    }

    // ✅ Add Pathway button handler - SINGLE REGISTRATION
    const addStopBtn = addSection()?.querySelector('#addStopBtn');
    if (addStopBtn) {
        // Remove any existing listeners first
        const newAddStopBtn = addStopBtn.cloneNode(true);
        addStopBtn.parentNode.replaceChild(newAddStopBtn, addStopBtn);
        
        // Now add the listener to the fresh button
        newAddStopBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Add Pathway button clicked, isAddingStop:', isAddingStop);
            
            if (!endMarker) {
                showToast('Please select a destination first.', 'error');
                return;
            }
            
            isAddingStop = !isAddingStop;
            console.log('isAddingStop toggled to:', isAddingStop);
            
            if (isAddingStop) {
                this.classList.remove('btn-outline-success');
                this.classList.add('btn-success');
                this.innerHTML = '<i class="fas fa-map-pin me-1"></i>Click on map to add pathway';
                showToast('Click on the map (within the blue area) to add pathway stops. Click "Add Pathway" again when done.', 'info');
            } else {
                this.classList.remove('btn-success');
                this.classList.add('btn-outline-success');
                this.innerHTML = '<i class="fas fa-map-pin me-1"></i>Add Pathway';
                showToast('Pathway mode disabled.', 'info');
            }
        });
        console.log('Add Pathway button event listener attached');
    } else {
        console.error('Add Pathway button not found!');
    }

    // Destination search — registered once here so initializeMap() re-runs don't stack listeners
    const searchInput = addSection()?.querySelector('#destinationSearch');
    const resultsContainer = addSection()?.querySelector('#geocodingResults');
    if (searchInput && resultsContainer) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(debounceTimer);
            if (query.length < 3) { resultsContainer.style.display = 'none'; return; }
            debounceTimer = setTimeout(() => {
                const boundary = getCurrentBoundary();
                const BBOX = `${boundary.swLng},${boundary.swLat},${boundary.neLng},${boundary.neLat}`;
                fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
                    `bbox=${BBOX}&country=PH&types=place,locality,neighborhood,address&access_token=${mapboxgl.accessToken}`
                )
                .then(res => res.json())
                .then(data => {
                    resultsContainer.innerHTML = '';
                    if (data.features && data.features.length > 0) {
                        data.features.forEach(feature => {
                            const item = document.createElement('a');
                            item.href = '#';
                            item.className = 'list-group-item list-group-item-action';
                            item.textContent = feature.place_name;
                            item.onclick = (event) => {
                                event.preventDefault();
                                const [lng, lat] = feature.center;
                                resultsContainer.style.display = 'none';
                                searchInput.value = feature.place_name;
                                const coords = { lng, lat };
                                if (isPointInAllowedArea(lng, lat)) {
                                    if (endMarker) endMarker.remove();
                                    endMarker = new mapboxgl.Marker({ color: 'red' })
                                        .setLngLat(coords).addTo(routeMap);
                                    if (addEl('end_location')) addEl('end_location').value = feature.place_name;
                                    if (addEl('end_coordinates')) addEl('end_coordinates').value = `${lng},${lat}`;
                                    autoGenerateRouteCode(feature.text);
                                    calculateRouteWithStops();
                                    showToast('Destination set via search!', 'success');
                                } else {
                                    const terminalName = (userTerminal === 'south') ? 'Southern Cebu' : 'Northern Cebu';
                                    showToast(`Location is outside ${terminalName}`, 'error');
                                }
                            };
                            resultsContainer.appendChild(item);
                        });
                        resultsContainer.style.display = 'block';
                    } else {
                        resultsContainer.style.display = 'none';
                    }
                })
                .catch(() => { resultsContainer.style.display = 'none'; });
            }, 300);
        });
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.style.display = 'none';
            }
        });
    }

    // Prevent Enter key from accidentally submitting the route form
    const routeFormEl = document.getElementById('routeForm');
    if (routeFormEl) {
        routeFormEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
                e.preventDefault();
            }
        });
    }

    const viewRouteFormEl = document.getElementById('viewRouteForm');
    if (viewRouteFormEl) {
        viewRouteFormEl.addEventListener('submit', function(e) {
            e.preventDefault();
        });
        viewRouteFormEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') e.preventDefault();
        });
    }

    // Form submission handler
    const form = document.getElementById('routeForm');
    if (form) {
        form.addEventListener('submit', function(e) {
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
                showToast('End coordinates are missing. Re-select the destination on the map.', 'error');
                return;
            }
            if (!addEl('distance_km')?.value?.trim() || !addEl('estimated_duration')?.value?.trim()) {
                showToast('Distance and duration are not set. Wait for the route line to finish loading, then try again.', 'error');
                return;
            }

            const formData = new FormData(form);
            
            const terminal = currentTerminal || TERMINALS.north;
            formData.set('start_location', terminal.name);
            formData.set('start_coordinates', `${terminal.coordinates[0]},${terminal.coordinates[1]}`);
            
            formData.set('stops_data', JSON.stringify(stops));
            formData.set('geometry', addEl('geometry').value);
            
            // ✅ Log form data for debugging
            console.log('Submitting form data:');
            for (let [key, value] of formData.entries()) {
                console.log(`${key}:`, value);
            }
            
            const saveBtn = addEl('saveRouteBtn');
            const originalText = saveBtn.innerHTML;
            const routeId = addEl('route_id')?.value || '';
            const isEdit = routeId !== '';
            
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
            
            const url = isEdit ? `/routes/${routeId}` : '/routes';
            if (isEdit) {
                formData.append('_method', 'PUT');
            }
            
            fetch(url, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                    'Accept': 'application/json'
                }
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        console.error('Server error response:', err);
                        return Promise.reject(err);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data && data.success) {
                    showToast(data.message || 'Route saved successfully', 'success');
                    hideRouteForm();
                    setTimeout(() => window.location.reload(), 500);
                } else if (data && data.errors) {
                    console.error('Validation errors:', data.errors);
                    showValidationErrors(data.errors);
                    showToast('Please fix the errors in the form.', 'error');
                } else {
                    showToast(data.message || 'Unknown error occurred', 'error');
                }
            })
            .catch(error => {
                console.error('Catch error:', error);
                if (error && error.errors) {
                    showValidationErrors(error.errors);
                    showToast('Please fix the errors in the form.', 'error');
                } else if (error && error.message) {
                    showToast(error.message, 'error');
                } else {
                    showToast('Error saving route', 'error');
                }
            })
            .finally(() => {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
            });
        });
    }

    // Bus type change handler (add form only)
    const busTypeSelect = addSection()?.querySelector('#bus_type');
    if (busTypeSelect) {
        busTypeSelect.addEventListener('change', function() {
            const distanceInput = addEl('distance_km');
            if (distanceInput && distanceInput.value) {
                calculateFare();
            }
        });
    }

    // Modal close handlers
    const viewModalCloseBtn = document.querySelector('#viewRouteModal .btn-close');
    if (viewModalCloseBtn) {
        viewModalCloseBtn.addEventListener('click', hideViewModal);
    }

    const viewModal = document.getElementById('viewRouteModal');
    if (viewModal) {
        viewModal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideViewModal();
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const viewModal = document.getElementById('viewRouteModal');
            if (viewModal && viewModal.style.display === 'block') {
                hideViewModal();
            }
        }
    });

    const confirmDeleteRouteBtn = document.getElementById('confirmDeleteRouteBtn');
    if (confirmDeleteRouteBtn) {
        confirmDeleteRouteBtn.addEventListener('click', performDeleteRoute);
    }
    const cancelDeleteRouteBtn = document.getElementById('cancelDeleteRouteBtn');
    if (cancelDeleteRouteBtn) {
        cancelDeleteRouteBtn.addEventListener('click', function() {
            routeToDelete = null;
        });
    }
    const deleteRouteModal = document.getElementById('deleteRouteModal');
    if (deleteRouteModal) {
        deleteRouteModal.addEventListener('hidden.bs.modal', function() {
            routeToDelete = null;
        });
    }
});

window.showAddRouteForm = showAddRouteForm;
window.hideRouteForm = hideRouteForm;
window.hideViewRouteForm = hideViewRouteForm;
window.clearEndPoint = clearEndPoint;
window.centerMapToCebu = centerMapToCebu;
window.hideViewModal = hideViewModal;
window.calculateFare = calculateFare;
window.clearStops = clearStops;

function viewRoute(id) {
  fetch(`/api/routes/${id}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success || !data.route) {
        showToast('Failed to load route details', 'error');
        return;
      }

      activeFormMode = 'view';
      hideRouteForm();

      const r = data.route;
      const section = viewSection();
      if (section) {
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
      }

      const title = document.getElementById('view_formTitle');
      if (title) title.innerHTML = '<i class="fas fa-eye me-2"></i>View Route';

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
      if (viewEl('route_status')) {
        viewEl('route_status').value = r.status === 'active' ? 'Active' : 'Inactive';
      }
      if (viewEl('bus_type')) {
        viewEl('bus_type').value = r.bus_type === 'aircon' ? 'Air-Con' : 'Regular';
      }
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

      initializeMap({
        mode: 'view',
        readOnly: true,
        onLoad: async () => {
          if (!routeMap) return;
          routeMap.resize();

          endMarker = null;
          stopMarkers = [];

          const terminal = currentTerminal || TERMINALS.north;
          if (startMarker) {
            startMarker.setLngLat(terminal.coordinates);
          }

          const endPt = parseCoordPair(r.end_coordinates);
          if (endPt) {
            endMarker = new mapboxgl.Marker({ color: 'red' })
              .setLngLat(endPt)
              .addTo(routeMap);
          }

          stops.forEach(stop => {
            const lng = stop.lng != null ? Number(stop.lng) : NaN;
            const lat = stop.lat != null ? Number(stop.lat) : NaN;
            if (Number.isFinite(lng) && Number.isFinite(lat)) {
              const marker = new mapboxgl.Marker({ color: 'blue' })
                .setLngLat([lng, lat])
                .setPopup(new mapboxgl.Popup().setText(`Pathway Stop: ${stop.name || ''}`))
                .addTo(routeMap);
              stopMarkers.push(marker);
            }
          });

          updateStopsList();
          await renderViewRoutePath(r);
        },
      });
    })
    .catch(error => {
      console.error('Error loading route:', error);
      showToast('Failed to load route details', 'error');
    });
}

let routeToDelete = null;

function showRouteModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) return;
    if (typeof window.bootstrap !== 'undefined') {
        const existing = window.bootstrap.Modal.getInstance(modalElement);
        if (existing) {
            existing.show();
        } else {
            new window.bootstrap.Modal(modalElement).show();
        }
    } else {
        modalElement.classList.add('show');
        modalElement.style.display = 'block';
        modalElement.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }
}

function hideRouteModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) return;
    if (typeof window.bootstrap !== 'undefined') {
        const instance = window.bootstrap.Modal.getInstance(modalElement);
        if (instance) instance.hide();
    } else {
        modalElement.classList.remove('show');
        modalElement.style.display = 'none';
        modalElement.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    }
}

function deleteRoute(id, routeName) {
    routeToDelete = id;
    const nameEl = document.getElementById('deleteRouteModalRouteName');
    if (nameEl) {
        nameEl.textContent = routeName ? `Route: ${routeName}` : '';
        nameEl.style.display = routeName ? 'block' : 'none';
    }
    showRouteModal('deleteRouteModal');
}

function performDeleteRoute() {
    if (!routeToDelete) return;

    const id = routeToDelete;
    fetch(`/routes/${id}`, {
        method: 'DELETE',
        headers: {
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
            'Accept': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('Route deleted successfully', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showToast(data.message || 'Failed to delete route', 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting route:', error);
        showToast('Failed to delete route', 'error');
    })
    .finally(() => {
        routeToDelete = null;
        hideRouteModal('deleteRouteModal');
    });
}

function hideViewModal() {
    const modal = document.getElementById('viewRouteModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.hideViewModal = hideViewModal;
window.showAddRouteForm = showAddRouteForm;
window.hideRouteForm = hideRouteForm;
// window.editRoute = editRoute;
window.viewRoute = viewRoute;
window.deleteRoute = deleteRoute;
window.calculateFare = calculateFare;

function getPlaceName(lng, lat, callback) {
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}`)
        .then(res => res.json())
        .then(data => {
            if (data.features && data.features.length > 0) {
                callback(data.features[0].place_name);
            } else {
                callback(`${lng},${lat}`);
            }
        })
        .catch(() => callback(`${lng},${lat}`));
}

function initializeMapForEdit(routeData) {
  if (routeMap) {
    routeMap.remove();
  }

  routeMap = new mapboxgl.Map({
    container: 'routeMap',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: (currentTerminal || TERMINALS.north).coordinates,
    zoom: CEBU_COORDINATES.zoom
  });

  routeMap.addControl(new mapboxgl.NavigationControl());

  // Start marker (fixed)
  startMarker = new mapboxgl.Marker({ color: 'green' })
    .setLngLat((currentTerminal || TERMINALS.north).coordinates)
    .addTo(routeMap);

  // End marker from saved data
  if (routeData.end_coordinates) {
    const [lng, lat] = routeData.end_coordinates.split(',').map(Number);
    if (!isNaN(lng) && !isNaN(lat)) {
      endMarker = new mapboxgl.Marker({ color: 'red' })
        .setLngLat([lng, lat])
        .addTo(routeMap);
    }
  }

  // Stop markers from saved data
  stopMarkers = [];
  stops = routeData.stops_data || [];
  stops.forEach(stop => {
    if (stop.lng && stop.lat) {
      const marker = new mapboxgl.Marker({ color: 'blue' })
        .setLngLat([stop.lng, stop.lat])
        .setPopup(new mapboxgl.Popup().setText(`Stop: ${stop.name || ''}`))
        .addTo(routeMap);
      stopMarkers.push(marker);
    }
  });

  // Draw saved route geometry
  if (routeData.geometry) {
    const geoJson = parseRouteLineStringGeometry(routeData.geometry);
    if (geoJson && geoJson.coordinates) {
      drawRoute(geoJson);
      const bounds = new mapboxgl.LngLatBounds();
      geoJson.coordinates.forEach(coord => bounds.extend(coord));
      routeMap.fitBounds(bounds, { padding: 40 });
    } else {
      console.error('Invalid geometry: could not parse LineString');
    }
  }

  // Re-enable map click listeners
routeMap.on('load', function() {
    // ✅ USE dynamic boundary
    const boundary = getCurrentBoundary();
    
    const cebuPolygon = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [boundary.swLng, boundary.swLat],
          [boundary.neLng, boundary.swLat],
          [boundary.neLng, boundary.neLat],
          [boundary.swLng, boundary.neLat],
          [boundary.swLng, boundary.swLat]
        ]]
      }
    };
    
    routeMap.addSource('cebu-boundary', {
      type: 'geojson',
      data: cebuPolygon
    });
    
    routeMap.addLayer({
      id: 'cebu-fill',
      type: 'fill',
      source: 'cebu-boundary',
      paint: { 'fill-color': '#0080ff', 'fill-opacity': 0.15 }
    });
    
    routeMap.addLayer({
      id: 'cebu-border',
      type: 'line',
      source: 'cebu-boundary',
      paint: { 'line-color': '#0080ff', 'line-width': 2, 'line-dasharray': [2, 2] }
    });
  });

  // Re-enable click handlers
  routeMap.on('click', function(e) {
    if (isAddingStop) {
      addStop(e.lngLat);
    } else if (!endMarker) {
      setEndPoint(e.lngLat);
    }
  });

  // Recalculate fare based on saved data
  setTimeout(() => {
    if (routeData.distance_km && routeData.bus_type) {
      document.getElementById('distance_km').value = routeData.distance_km;
      document.getElementById('bus_type').value = routeData.bus_type;
      calculateFare();
    }
  }, 500);
}
