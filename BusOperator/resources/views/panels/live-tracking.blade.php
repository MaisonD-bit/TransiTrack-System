@extends('layouts.apptwo')

@section('content')
<div class="container-fluid px-4 py-3">
    <div class="d-flex align-items-center justify-content-between mb-3">
        <div>
            <h3 class="mb-0">Live Tracking</h3>
            <small class="text-muted">Shows the most recent driver GPS pings (last 10 minutes).</small>
        </div>
        <div class="d-flex gap-2 align-items-center">
            <button class="btn btn-outline-primary btn-sm" id="btnRecenter">
                <i class="fas fa-crosshairs me-1"></i>Fit
            </button>
            <button class="btn btn-outline-secondary btn-sm" id="btnRefresh">
                <i class="fas fa-sync-alt me-1"></i>Refresh
            </button>
        </div>
    </div>

    <div class="row g-3">
        <div class="col-lg-9">
            <div class="card shadow-sm border-0">
                <div class="card-body p-0">
                    <div id="liveMap" style="height: 72vh; min-height: 420px; width: 100%; border-radius: 10px;"></div>
                </div>
            </div>
        </div>
        <div class="col-lg-3">
            <div class="card shadow-sm border-0">
                <div class="card-header bg-white">
                    <strong>Drivers</strong>
                    <div class="text-muted small">Last update: <span id="lastUpdate">—</span></div>
                </div>
                <div class="card-body p-0">
                    <div id="driverList" class="list-group list-group-flush">
                        <div class="p-3 text-muted small">Loading…</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

@push('scripts')
<script>
(() => {
    const map = new mapboxgl.Map({
        container: 'liveMap',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [123.8854, 10.3157], // Cebu
        zoom: 11
    });

    const markers = new Map(); // driver_id -> marker

    function formatTimeAgo(iso) {
        if (!iso) return '—';
        const t = new Date(iso).getTime();
        if (!t) return '—';
        const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
        if (diffSec < 60) return diffSec + 's ago';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return diffMin + 'm ago';
        return Math.floor(diffMin / 60) + 'h ago';
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    async function fetchLocations() {
        // Use a wider window so the map isn't empty when a driver briefly loses GPS/network.
        const res = await fetch('/api/v1/live/driver-locations?since_minutes=120', { headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        if (!data || !data.success) return;

        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();

        const list = document.getElementById('driverList');
        list.innerHTML = '';

        const bounds = new mapboxgl.LngLatBounds();
        let hasAny = false;

        (data.locations || []).forEach((loc) => {
            const driver = loc.driver || {};
            const driverId = driver.id || loc.driver_id;
            const lat = Number(loc.latitude);
            const lng = Number(loc.longitude);
            if (!driverId || isNaN(lat) || isNaN(lng)) return;

            const label = escapeHtml(driver.name || `Driver ${driverId}`);
            const ago = formatTimeAgo(loc.recorded_at);
            const recordedAtMs = loc.recorded_at ? new Date(loc.recorded_at).getTime() : 0;
            const ageMin = recordedAtMs ? (Date.now() - recordedAtMs) / 60000 : Infinity;
            const isStale = ageMin > 10;
            const sched = loc.schedule;
            const routeName = sched && sched.route ? escapeHtml(sched.route.name || '') : '';
            const busLabel = sched && sched.bus ? escapeHtml(`${sched.bus.bus_number || ''}`) : '';
            const status = sched ? escapeHtml((sched.status || '').toUpperCase()) : '';

            const item = document.createElement('div');
            item.className = 'list-group-item';
            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <div class="fw-semibold">${label}</div>
                        <div class="small ${isStale ? 'text-warning' : 'text-muted'}">${ago}${isStale ? ' (stale)' : ''}</div>
                        ${routeName ? `<div class="small mt-1">${routeName}</div>` : ''}
                        ${(busLabel || status) ? `<div class="small text-muted">${busLabel}${busLabel && status ? ' · ' : ''}${status}</div>` : ''}
                    </div>
                    <button class="btn btn-sm btn-outline-primary">View</button>
                </div>
            `;
            item.querySelector('button').addEventListener('click', () => {
                map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14) });
            });
            list.appendChild(item);

            let marker = markers.get(driverId);
            if (!marker) {
                marker = new mapboxgl.Marker({ color: isStale ? '#9ca3af' : '#2563eb' }).setLngLat([lng, lat]).addTo(map);
                markers.set(driverId, marker);
            } else {
                marker.setLngLat([lng, lat]);
                // Update marker color if staleness changed
                const el = marker.getElement && marker.getElement();
                if (el) {
                    el.style.filter = isStale ? 'grayscale(1)' : '';
                    el.style.opacity = isStale ? '0.75' : '1';
                }
            }

            bounds.extend([lng, lat]);
            hasAny = true;
        });

        // Remove markers not present anymore
        const idsInPayload = new Set((data.locations || []).map((l) => (l.driver && l.driver.id) || l.driver_id));
        for (const [id, m] of markers.entries()) {
            if (!idsInPayload.has(id)) {
                m.remove();
                markers.delete(id);
            }
        }

        if (hasAny) {
            map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
        }
    }

    document.getElementById('btnRefresh').addEventListener('click', fetchLocations);
    document.getElementById('btnRecenter').addEventListener('click', fetchLocations);

    map.on('load', () => {
        fetchLocations();
        setInterval(fetchLocations, 5000);
    });
})();
</script>
@endpush
@endsection

