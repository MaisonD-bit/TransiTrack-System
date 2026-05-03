document.addEventListener('DOMContentLoaded', function() {
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [123.8854, 10.3157],
        zoom: 13
    });

    map.addControl(new mapboxgl.NavigationControl());

    let currentMarker = null;
    let routeLayer = null;

    function updateDriverRoute(driverId) {
        // Clear existing route and markers
        if (routeLayer) {
            map.removeLayer('route');
            map.removeSource('route');
        }
        if (currentMarker) {
            currentMarker.remove();
        }

        const routeCoordinates = [
            [123.9177, 10.3311], // North Bus Terminal
            [123.9158, 10.3119], // SM City Cebu
            [123.8914, 10.3172], // Cebu Capitol
            [123.8844, 10.2933]  // South Bus Terminal
        ];

        // Add "You are here" marker at the starting point
        const startPoint = routeCoordinates[0];
        const el = document.createElement('div');
        el.className = 'marker-start';
        el.style.backgroundImage = 'url(https://cdn.mapmarker.io/api/v1/pin?size=50&background=%2334A853&icon=fa-arrow-down&color=%23FFFFFF)';
        el.style.width = '50px';
        el.style.height = '50px';
        el.style.backgroundSize = '100%';

        currentMarker = new mapboxgl.Marker(el)
            .setLngLat(startPoint)
            .setPopup(new mapboxgl.Popup({ offset: 25 })
                .setHTML('<h3>You are here</h3><p>Starting point: North Bus Terminal</p>'))
            .addTo(map);

        // Add the route
        map.addSource('route', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': routeCoordinates
                }
            }
        });

        map.addLayer({
            'id': 'route',
            'type': 'line',
            'source': 'route',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#00bfff',
                'line-width': 5
            }
        });

        // Fit map to show entire route
        const bounds = new mapboxgl.LngLatBounds();
        routeCoordinates.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds, { padding: 50 });
    }

    document.getElementById('driver-select').addEventListener('change', function() {
        const driverId = this.value;
        updateDriverRoute(driverId);
    });
});