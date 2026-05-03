let routeMap;
let startMarker, endMarker;
let routeLayer;
let stopMarkers = [];
let stops = [];
let isAddingStop = false;

// Fare rates
const FARE_RATES = {
    BASE_FARE: 15,
    LOW_RATE: 2.50,
    MID_RATE: 3.00,
    HIGH_RATE: 3.50,
    AIRCON_MARKUP: 0.30
};

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

let userTerminal = null;
let currentTerminal = null;

const TERMINAL_BOUNDARIES = {
    north: {
        swLng: 123.6,
        swLat: 10.280000,
        neLng: 124.10,
        neLat: 11.30
    },
    south: {
        swLng: 123.25,      // West of Cebu City
        swLat: 9.50,        // South boundary (covers Oslob, Santander)
        neLng: 123.95,      // East boundary
        neLat: 10.35        // North boundary (up to Cebu City)
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
    const inputs = document.querySelectorAll('.form-control, .form-select');
    inputs.forEach(input => {
        input.classList.remove('is-invalid');
    });
    const errorDivs = document.querySelectorAll('.invalid-feedback');
    errorDivs.forEach(div => {
        div.textContent = '';
    });
}

function showValidationErrors(errors) {
    clearValidationErrors();
    for (const [field, messages] of Object.entries(errors)) {
        const input = document.getElementById(field === 'code' ? 'route_code' : field === 'name' ? 'route_name' : field === 'status' ? 'route_status' : field);
        const errorDiv = document.getElementById(`${field}_error`);
        if (input && errorDiv) {
            input.classList.add('is-invalid');
            errorDiv.textContent = messages[0];
        }
    }
}

//   FIXED: Proper map initialization with boundary
function initializeMap() {
    if (routeMap) {
        routeMap.remove();
    }
    
    // ✅ Use current terminal or default to north
    const terminal = currentTerminal || TERMINALS.north;
    
    routeMap = new mapboxgl.Map({
        container: 'routeMap',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: terminal.coordinates, // ✅ Center on user's terminal
        zoom: CEBU_COORDINATES.zoom
    });
    
    routeMap.addControl(new mapboxgl.NavigationControl());

    // ✅ Place start marker at user's terminal
    startMarker = new mapboxgl.Marker({ color: 'green' })
        .setLngLat(terminal.coordinates)
        .addTo(routeMap);

    routeMap.on('load', function() {
        console.log('Map loaded with terminal:', terminal.name);

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
    });

    routeMap.on('click', function(e) {
        console.log('Map clicked at:', e.lngLat);
        console.log('isAddingStop mode:', isAddingStop);
        console.log('endMarker exists:', !!endMarker);
        
        if (isAddingStop) {
            console.log('Adding pathway stop...');
            addStop(e.lngLat);
        } else if (!endMarker) {
            console.log('Setting end point...');
            setEndPoint(e.lngLat);
        } else {
            console.log('Map click ignored - end marker already set and not in pathway mode');
        }
    });

    const searchInput = document.getElementById('destinationSearch');
    const resultsContainer = document.getElementById('geocodingResults');

    if (searchInput && resultsContainer) {
        let debounceTimer;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(debounceTimer);

            if (query.length < 3) {
                resultsContainer.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(() => {
                // ✅ USE dynamic boundary
                const boundary = getCurrentBoundary();
                const BBOX = `${boundary.swLng},${boundary.swLat},${boundary.neLng},${boundary.neLat}`;
                
                fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
                    `bbox=${BBOX}&` +
                    `country=PH&` +
                    `types=place,locality,neighborhood,address&` +
                    `access_token=${mapboxgl.accessToken}`
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
                                        .setLngLat(coords)
                                        .addTo(routeMap);
                                    document.getElementById('end_location').value = feature.place_name;
                                    document.getElementById('end_coordinates').value = `${lng},${lat}`;
                                    autoGenerateRouteCode(feature.text);
                                    calculateRouteWithStops();
                                    showToast('Destination set via search!', 'success');
                                } else {
                                    const terminalName = (userTerminal === 'south') ? 'Southern Cebu' : 'Northern Cebu';
                                    showToast(`Location is outside ${terminalName}`, 'error');                                }
                            };
                            resultsContainer.appendChild(item);
                        });
                        resultsContainer.style.display = 'block';
                    } else {
                        resultsContainer.style.display = 'none';
                    }
                })
                .catch(err => {
                    console.error('Geocoding error:', err);
                    resultsContainer.style.display = 'none';
                });
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.style.display = 'none';
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
        document.getElementById('end_location').value = placeName;
        document.getElementById('end_coordinates').value = `${coords.lng},${coords.lat}`;
        autoGenerateRouteCode(placeName);
        showToast('Destination set! You can now add pathway or save route.', 'success');
        calculateRouteWithStops();
    });
}

function autoGenerateRouteCode(placeName) {
    if (!placeName) return;
    let code = 'NT-' + placeName.split(',')[0].replace(/[^A-Za-z0-9]/g, '').substring(0, 6).toUpperCase();
    document.getElementById('route_code').value = code;
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
    const stopsList = document.getElementById('stopsList');
    stopsList.innerHTML = '';
    stops.forEach((stop, idx) => {
        stopsList.innerHTML += `
            <div class="d-flex align-items-center justify-content-between mb-2 p-2 bg-light rounded">
                <div class="d-flex align-items-center gap-2" style="flex: 1; min-width: 0;">
                    <span class="badge bg-primary">${idx + 1}</span>
                    <span class="text-dark text-truncate">${stop.name}</span>
                </div>
                <button 
                    type="button" 
                    class="btn btn-sm btn-danger" 
                    onclick="removeStop(${idx})" 
                    title="Remove pathway stop"
                    style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-left: 8px;"
                >
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    document.getElementById('stops_data').value = JSON.stringify(stops);
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

                const distanceInput = document.getElementById('distance_km');
                const durationInput = document.getElementById('estimated_duration');
                const geometryInput = document.getElementById('geometry');

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
    const distanceInput = document.getElementById('distance_km');
    const busTypeInput = document.getElementById('bus_type');
    const routeFareInput = document.getElementById('route_fare');

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

//   Add event listener for bus type change
document.addEventListener('DOMContentLoaded', function() {
    // Recalculate fare when bus type changes
    const busTypeSelect = document.getElementById('bus_type');
    if (busTypeSelect) {
        busTypeSelect.addEventListener('change', function() {
            console.log('Bus type changed to:', this.value);
            const distanceInput = document.getElementById('distance_km');
            if (distanceInput && distanceInput.value) {
                calculateFare();
            }
        });
    }
});

function drawRoute(geometry) {
    window.lastRouteGeometry = geometry;
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
            geometry: geometry
        }
    });
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
            'line-opacity': 0.8
        }
    });
}

function clearEndPoint() {
    if (endMarker) {
        endMarker.remove();
        endMarker = null;
    }
    clearStops();

    const addStopBtn = document.getElementById('addStopBtn');
    if (addStopBtn) {
        isAddingStop = false;
        addStopBtn.classList.remove('btn-success');
        addStopBtn.classList.add('btn-outline-success');
        addStopBtn.innerHTML = '<i class="fas fa-map-pin me-1"></i>Add Pathway';
    }

    if (routeMap && routeMap.getLayer('route')) {
        routeMap.removeLayer('route');
        routeMap.removeSource('route');
    }
    
    // ✅ Check if elements exist before setting values
    const endLocationInput = document.getElementById('end_location');
    const endCoordinatesInput = document.getElementById('end_coordinates');
    const distanceInput = document.getElementById('distance_km');
    const durationInput = document.getElementById('estimated_duration');
    const routeFareInput = document.getElementById('route_fare');
    const geometryInput = document.getElementById('geometry');
    
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
    document.getElementById('routeForm').reset();
    document.getElementById('route_id').value = '';
    document.getElementById('method_field').value = '';
    
    // ✅ Set terminal-based start location
    const terminal = currentTerminal || TERMINALS.north;
    document.getElementById('start_location').value = terminal.name;
    document.getElementById('start_coordinates').value = `${terminal.coordinates[0]},${terminal.coordinates[1]}`;
    
    document.getElementById('formTitle').innerHTML = '<i class="fas fa-route me-2"></i>Add New Route';
    document.getElementById('saveRouteBtn').innerHTML = '<i class="fas fa-save me-2"></i>Save Route';
    clearValidationErrors();
    document.getElementById('routeFormSection').style.display = 'block';
    document.getElementById('routeFormSection').scrollIntoView({ behavior: 'smooth' });
    
    setTimeout(() => {
        initializeMap();
        // ✅ Dynamic message based on terminal
        showToast(`Click on the highlighted blue area to select destination from ${terminal.name}`, 'info');
        
        document.getElementById('geometry').value = '';
        document.getElementById('stops_data').value = '[]';
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
    document.getElementById('routeFormSection').style.display = 'none';
    document.getElementById('routeForm').reset();
    if (routeMap) {
        routeMap.remove();
        routeMap = null;
    }
    startMarker = endMarker = null;
    clearStops();
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
    const addStopBtn = document.getElementById('addStopBtn');
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

    // Form submission handler
    const form = document.getElementById('routeForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();

            if (!document.getElementById('end_location').value) {
                showToast('Please select a destination on the map.', 'error');
                return;
            }

            if (!document.getElementById('geometry').value) {
                showToast('Please calculate the route first by clicking on the map.', 'error');
                return;
            }

            const formData = new FormData(form);
            
            // ✅ Ensure start_location is set
            const terminal = currentTerminal || TERMINALS.north;
            formData.set('start_location', terminal.name);
            formData.set('start_coordinates', `${terminal.coordinates[0]},${terminal.coordinates[1]}`);
            
            // ✅ Ensure stops_data is stringified
            formData.set('stops_data', JSON.stringify(stops));
            formData.set('geometry', document.getElementById('geometry').value);
            
            // ✅ Log form data for debugging
            console.log('Submitting form data:');
            for (let [key, value] of formData.entries()) {
                console.log(`${key}:`, value);
            }
            
            const saveBtn = document.getElementById('saveRouteBtn');
            const originalText = saveBtn.innerHTML;
            const routeId = document.getElementById('route_id').value;
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

    // Bus type change handler
    const busTypeSelect = document.getElementById('bus_type');
    if (busTypeSelect) {
        busTypeSelect.addEventListener('change', function() {
            console.log('Bus type changed to:', this.value);
            const distanceInput = document.getElementById('distance_km');
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
});

window.showAddRouteForm = showAddRouteForm;
window.hideRouteForm = hideRouteForm;
window.clearEndPoint = clearEndPoint;
window.centerMapToCebu = centerMapToCebu;
window.hideViewModal = hideViewModal;
window.calculateFare = calculateFare;
window.clearStops = clearStops;

function editRoute(id) {
  //   FIX: Use correct API endpoint
  fetch(`/api/routes/${id}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success || !data.route) {
        showToast('Failed to load route details', 'error');
        return;
      }
      showAddRouteForm();

      const r = data.route;
      // Set form fields
      document.getElementById('route_id').value = r.id;
      document.getElementById('method_field').value = 'PUT';
      document.getElementById('route_code').value = r.code || '';
      document.getElementById('route_name').value = r.name || '';
      document.getElementById('start_location').value = r.start_location || '';
      document.getElementById('end_location').value = r.end_location || '';
      document.getElementById('start_coordinates').value = r.start_coordinates || '';
      document.getElementById('end_coordinates').value = r.end_coordinates || '';
      document.getElementById('distance_km').value = r.distance_km || '';
      document.getElementById('estimated_duration').value = r.estimated_duration || '';
      document.getElementById('route_fare').value = r.route_fare || '';
      document.getElementById('route_status').value = r.status || 'active';
      document.getElementById('bus_type').value = r.bus_type || 'regular';
      document.getElementById('description').value = r.description || '';
      document.getElementById('geometry').value = r.geometry || '';
      
      // Load stops data into global variable
      stops = r.stops_data || [];
      document.getElementById('stops_data').value = JSON.stringify(stops);

      // Wait for map to initialize, then set end point and calculate route
      setTimeout(() => {
        if (!routeMap) return;

        // Set the end marker from saved coordinates
        if (r.end_coordinates) {
          const [lng, lat] = r.end_coordinates.split(',').map(Number);
          if (!isNaN(lng) && !isNaN(lat)) {
            endMarker = new mapboxgl.Marker({ color: 'red' })
              .setLngLat([lng, lat])
              .addTo(routeMap);
          }
        }

        // Add stop markers
        stopMarkers = [];
        stops.forEach(stop => {
          if (stop.lng && stop.lat) {
            const marker = new mapboxgl.Marker({ color: 'blue' })
              .setLngLat([stop.lng, stop.lat])
              .setPopup(new mapboxgl.Popup().setText(`Stop: ${stop.name || ''}`))
              .addTo(routeMap);
            stopMarkers.push(marker);
          }
        });

        // Update stops list UI
        updateStopsList();

        // Force recalculate route using saved geometry/stops
        if (r.geometry) {
          try {
            const geoJson = JSON.parse(r.geometry);
            drawRoute(geoJson);
            // Fit map to route
            const bounds = new mapboxgl.LngLatBounds();
            geoJson.coordinates.forEach(coord => bounds.extend(coord));
            routeMap.fitBounds(bounds, { padding: 40 });
          } catch (e) {
            console.error('Invalid geometry on edit:', e);
          }
        } else {
          // Fallback: recalculate via Mapbox if no geometry
          calculateRouteWithStops();
        }
      }, 300);
    })
    .catch(error => {
      console.error('Error loading route:', error);
      showToast('Failed to load route details', 'error');
    });
}

function deleteRoute(id) {
    if (!confirm('Are you sure you want to delete this route?')) return;
    
    //   FIX: Use correct endpoint
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
    });
}

function viewRoute(id) {
    //   FIX: Use correct API endpoint
    fetch(`/api/routes/${id}`)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            if (!data.success || !data.route) {
                showToast('Failed to load route details', 'error');
                return;
            }

            const r = data.route;

            let stopsHtml = '';
            if (r.stops_data && r.stops_data.length) {
                stopsHtml = '<ol class="mb-0 ps-3">';
                r.stops_data.forEach((stop, idx) => {
                    stopsHtml += `<li class="mb-1">${stop.name || stop}</li>`;
                });
                stopsHtml += '</ol>';
            } else {
                stopsHtml = '<em>No stops for this route.</em>';
            }

            document.getElementById('viewRouteContent').innerHTML = `
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <h6 class="fw-bold mb-3"><i class="fas fa-info-circle me-2"></i>General Info</h6>
                        <div class="mb-2"><strong>Code:</strong> ${r.code || 'N/A'}</div>
                        <div class="mb-2"><strong>Name:</strong> ${r.name || 'N/A'}</div>
                        <div class="mb-2"><strong>Status:</strong> <span class="badge ${r.status === 'active' ? 'bg-success' : 'bg-secondary'}">${r.status || 'inactive'}</span></div>
                        <div class="mb-2"><strong>Bus Type:</strong> <span class="badge ${r.bus_type === 'aircon' ? 'bg-info' : 'bg-warning'}">${r.bus_type === 'aircon' ? 'Air-Con' : 'Regular'}</span></div>
                        <div class="mb-2"><strong>Description:</strong> ${r.description || '-'}</div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <h6 class="fw-bold mb-3"><i class="fas fa-route me-2"></i>Route Details</h6>
                        <div class="mb-2"><strong>Start:</strong> ${r.start_location || 'N/A'}</div>
                        <div class="mb-2"><strong>End:</strong> ${r.end_location || 'N/A'}</div>
                        <div class="mb-2"><strong>Distance:</strong> ${r.distance_km || 'N/A'} km</div>
                        <div class="mb-2"><strong>Duration:</strong> ${r.estimated_duration || 'N/A'} mins</div>
                        <div class="mb-2"><strong>Route Fare:</strong> ₱${parseFloat(r.route_fare || 0).toFixed(2)}</div>
                    </div>
                </div>
                <div class="row mt-3">
                    <div class="col-12">
                        <h6 class="fw-bold mb-2"><i class="fas fa-map-pin me-2"></i>Pathway Stops</h6>
                        ${stopsHtml}
                    </div>
                </div>
            `;
            document.getElementById('viewRouteModal').style.display = 'block';
        })
        .catch(error => {
            console.error('Error loading route:', error);
            showToast('Failed to load route details: ' + error.message, 'error');
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
window.editRoute = editRoute;
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
    try {
      const geoJson = JSON.parse(routeData.geometry);
      if (geoJson && geoJson.coordinates) {
        drawRoute(geoJson);
        // Fit map to route bounds
        const bounds = new mapboxgl.LngLatBounds();
        geoJson.coordinates.forEach(coord => bounds.extend(coord));
        routeMap.fitBounds(bounds, { padding: 40 });
      }
    } catch (e) {
      console.error('Invalid geometry:', e);
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
