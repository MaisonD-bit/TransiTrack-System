@extends('layouts.app')

@section('title', 'Review submission #'.$routeApprovalRequest->id)

@section('content')
<link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet" />
<div class="container-fluid">
    <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb mb-0">
            <li class="breadcrumb-item"><a href="{{ route('sysadmin.approvals') }}">Route approvals</a></li>
            <li class="breadcrumb-item active" aria-current="page">Submission #{{ $routeApprovalRequest->id }}</li>
        </ol>
    </nav>

    <div class="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-3">
        <div>
            <h2 class="mb-1 fw-bold">Review routes &amp; stops</h2>
            <p class="text-muted small mb-0">
                Terminal <span class="badge bg-secondary text-uppercase">{{ $routeApprovalRequest->terminal }}</span>
                · Operator:
                <strong>{{ $routeApprovalRequest->operator?->name ?? ('#'.$routeApprovalRequest->operator_user_id) }}</strong>
                · Submitted {{ ($routeApprovalRequest->submitted_for_sysadmin_at ?? $routeApprovalRequest->submitted_by_terminal_at)?->diffForHumans() ?? $routeApprovalRequest->created_at->diffForHumans() }}
            </p>
        </div>
        <div class="d-flex flex-wrap gap-2">
            <a href="{{ route('sysadmin.approvals') }}" class="btn btn-outline-secondary btn-sm">
                <i class="fas fa-arrow-left me-1"></i> Back to approvals
            </a>
            <form action="{{ route('sysadmin.approvals.approve', $routeApprovalRequest) }}" method="POST" class="d-inline js-sysadmin-approve-form" data-confirm-message="Approve this route package?">
                @csrf
                <button type="submit" class="btn btn-success btn-sm"><i class="fas fa-check"></i> Approve</button>
            </form>
            <button type="button" class="btn btn-outline-danger btn-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#declineModalReview"
                    data-decline-url="{{ route('sysadmin.approvals.decline', $routeApprovalRequest) }}"
                    data-decline-id="{{ $routeApprovalRequest->id }}">Decline</button>
        </div>
    </div>

    <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-light fw-semibold d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span>Map</span>
            @if(count($layers))
                <div class="d-flex flex-wrap align-items-center gap-2">
                    <label for="sysadmin-route-select" class="small text-muted mb-0">Route</label>
                    <select id="sysadmin-route-select" class="form-select form-select-sm" style="min-width: 220px; max-width: min(100%, 360px);" aria-label="Select route to display on map">
                        @foreach($layers as $layer)
                            <option value="{{ $layer['id'] }}">{{ $layer['name'] }} ({{ $layer['code'] }})</option>
                        @endforeach
                    </select>
                </div>
            @endif
        </div>
        <div class="card-body">
            @if(!count($layers))
                <p class="text-muted small mb-2">No routes in this submission.</p>
            @endif
            <div id="sysadmin-review-map" class="rounded border overflow-hidden {{ count($layers) ? '' : 'opacity-50' }}" style="height: 480px; width: 100%;"></div>
            <p class="small text-muted mt-2 mb-0 d-none" id="sysadmin-review-map-warning" role="alert"></p>
            <p class="small text-muted mt-2 mb-0 d-none" id="sysadmin-review-route-hint" role="status"></p>
        </div>
    </div>

    @foreach($layers as $layer)
        <div class="card border-0 shadow-sm mb-3 sysadmin-stops-panel {{ $loop->first ? '' : 'd-none' }}" data-route-id="{{ $layer['id'] }}">
            <div class="card-header bg-light fw-semibold">{{ $layer['name'] }} <span class="text-muted small">({{ $layer['code'] }})</span></div>
            <div class="card-body p-0">
                <p class="small text-muted px-3 pt-3 mb-2 mb-md-3">
                    <strong>From route start</strong> is total travel time from the beginning of the path (cumulative). <strong>Leg</strong> is travel time for that segment (from the previous stop, or from the start for the first stop).
                </p>
                <div class="table-responsive">
                    <table class="table table-sm mb-0 align-middle">
                        <thead class="table-light">
                            <tr>
                                <th>#</th>
                                <th>Stop name</th>
                                <th>From route start (min)</th>
                                <th>Leg (min)</th>
                                <th class="small text-muted">lng / lat</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($layer['stops'] as $idx => $stop)
                                @php
                                    $etaRaw = $stop['eta_minutes'] ?? null;
                                    $eta = is_numeric($etaRaw) ? (int) $etaRaw : null;
                                    $leg = null;
                                    if ($eta !== null) {
                                        if ($idx === 0) {
                                            $leg = $eta;
                                        } else {
                                            $prevRaw = $layer['stops'][$idx - 1]['eta_minutes'] ?? null;
                                            $prevEta = is_numeric($prevRaw) ? (int) $prevRaw : null;
                                            $leg = $prevEta !== null ? max(0, $eta - $prevEta) : null;
                                        }
                                    }
                                @endphp
                                <tr>
                                    <td>{{ $idx + 1 }}</td>
                                    <td>{{ $stop['name'] ?? '—' }}</td>
                                    <td>{{ $eta !== null ? $eta : '—' }}</td>
                                    <td>{{ $leg !== null ? $leg : '—' }}</td>
                                    <td class="small text-muted font-monospace">
                                        {{ isset($stop['lng']) ? number_format((float) $stop['lng'], 5) : '—' }},
                                        {{ isset($stop['lat']) ? number_format((float) $stop['lat'], 5) : '—' }}
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="5" class="text-center text-muted py-3">No stops recorded for this route in this submission.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    @endforeach
</div>

<div class="modal fade" id="declineModalReview" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <form method="POST" id="declineFormReview">
                @csrf
                <div class="modal-header">
                    <h5 class="modal-title">Decline request</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <label class="form-label">Reason (optional)</label>
                    <textarea name="reason" class="form-control" rows="3"></textarea>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-danger">Decline</button>
                </div>
            </form>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"></script>
<script type="application/json" id="sysadmin-review-layers-json">@json($layers)</script>
<script>
(function () {
    const token = @json(config('services.mapbox.token'));
    const terminalKey = @json(strtolower((string) ($routeApprovalRequest->terminal ?? 'north')));
    const layersEl = document.getElementById('sysadmin-review-layers-json');
    const warnEl = document.getElementById('sysadmin-review-map-warning');
    const routeHintEl = document.getElementById('sysadmin-review-route-hint');
    const routeSelect = document.getElementById('sysadmin-route-select');
    let layers = [];
    try {
        layers = layersEl ? JSON.parse(layersEl.textContent || '[]') : [];
    } catch (e) {
        layers = [];
    }

    const ROUTE_LINE_SRC = 'sysadmin-active-route';
    const ROUTE_LINE_LAYER = 'sysadmin-active-route-line';
    const LINE_COLOR = '#c0392b';
    const TERMINALS = {
        north: { coordinates: [123.920994, 10.311008], name: 'Cebu North Bus Terminal' },
        south: { coordinates: [123.893356, 10.298361], name: 'Cebu South Bus Terminal' },
    };
    let markers = [];

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function parseLngLatPair(str) {
        if (!str || typeof str !== 'string') return null;
        const parts = str.split(',').map(function (s) { return parseFloat(String(s).trim()); });
        if (parts.length < 2 || parts.some(function (n) { return Number.isNaN(n); })) return null;
        return [parts[0], parts[1]];
    }

    function getRouteStartPoint(layer, coords) {
        if (!layer) return null;
        const fromField = parseLngLatPair(layer.start_coordinates);
        if (fromField) {
            return { lngLat: fromField, label: (layer.start_location || 'Start').trim() || 'Start' };
        }
        const term = TERMINALS[terminalKey] || TERMINALS.north;
        if (term) {
            return { lngLat: term.coordinates, label: term.name };
        }
        if (coords && coords.length) {
            return { lngLat: coords[0], label: (layer.start_location || 'Start').trim() || 'Start' };
        }
        return null;
    }

    function getRouteEndPoint(layer, coords) {
        if (!layer) return null;
        const label = (layer.end_location || 'End point').trim() || 'End point';
        const fromField = parseLngLatPair(layer.end_coordinates);
        if (fromField) {
            return { lngLat: fromField, label: label };
        }
        if (coords && coords.length) {
            return { lngLat: coords[coords.length - 1], label: label };
        }
        return null;
    }

    function normalizeLineString(geometry) {
        let g = geometry;
        if (!g) return null;
        if (typeof g === 'string') {
            try { g = JSON.parse(g); } catch { return null; }
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

    function clearMarkers() {
        markers.forEach(function (m) {
            try {
                m.remove();
            } catch (e) { /* ignore */ }
        });
        markers = [];
    }

    function removeActiveRouteLayer(map) {
        if (map.getLayer(ROUTE_LINE_LAYER)) map.removeLayer(ROUTE_LINE_LAYER);
        if (map.getSource(ROUTE_LINE_SRC)) map.removeSource(ROUTE_LINE_SRC);
    }

    function syncStopsPanel(routeId) {
        document.querySelectorAll('.sysadmin-stops-panel').forEach(function (el) {
            const match = el.getAttribute('data-route-id') === String(routeId);
            el.classList.toggle('d-none', !match);
        });
    }

    const declineModal = document.getElementById('declineModalReview');
    if (declineModal) {
        declineModal.addEventListener('show.bs.modal', function (event) {
            const btn = event.relatedTarget;
            const form = declineModal.querySelector('#declineFormReview');
            const title = declineModal.querySelector('.modal-title');
            if (btn && form && btn.dataset.declineUrl) {
                form.action = btn.dataset.declineUrl;
                if (title && btn.dataset.declineId) {
                    title.textContent = 'Decline request #' + btn.dataset.declineId;
                }
            }
        });
    }

    if (!token || !window.mapboxgl) {
        if (warnEl) {
            warnEl.textContent = 'Map unavailable: set MAPBOX_TOKEN in SysAdmin .env';
            warnEl.classList.remove('d-none');
        }
        return;
    }

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
        container: 'sysadmin-review-map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [123.8854, 10.3157],
        zoom: 10,
    });

    function displayRouteOnMap(routeId) {
        const layer = layers.find(function (l) {
            return String(l.id) === String(routeId);
        });

        clearMarkers();
        removeActiveRouteLayer(map);

        if (routeHintEl) {
            routeHintEl.classList.add('d-none');
            routeHintEl.textContent = '';
        }
        if (warnEl) {
            warnEl.classList.add('d-none');
        }

        if (!layer) {
            return;
        }

        const coords = normalizeLineString(layer.geometry);
        const hasLine = coords && coords.length >= 2;

        if (hasLine) {
            map.addSource(ROUTE_LINE_SRC, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: coords },
                },
            });
            map.addLayer({
                id: ROUTE_LINE_LAYER,
                type: 'line',
                source: ROUTE_LINE_SRC,
                paint: {
                    'line-color': LINE_COLOR,
                    'line-width': 5,
                    'line-opacity': 0.9,
                },
            });
        } else if (routeHintEl) {
            routeHintEl.textContent = 'No route path geometry for this route in the database. The operator must save the route path first.';
            routeHintEl.classList.remove('d-none');
        }

        const startPt = getRouteStartPoint(layer, coords);
        if (startPt) {
            const startMk = new mapboxgl.Marker({ color: '#2ecc71' })
                .setLngLat(startPt.lngLat)
                .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML('<strong>' + escapeHtml(startPt.label) + '</strong><br><span class="small text-muted">Route start</span>'))
                .addTo(map);
            markers.push(startMk);
        }

        const endPt = getRouteEndPoint(layer, coords);
        if (endPt) {
            const endMk = new mapboxgl.Marker({ color: '#e74c3c' })
                .setLngLat(endPt.lngLat)
                .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML('<strong>' + escapeHtml(endPt.label) + '</strong><br><span class="small text-muted">Route end</span>'))
                .addTo(map);
            markers.push(endMk);
        }

        (layer.stops || []).forEach(function (s, idx) {
            const lng = parseFloat(s.lng);
            const lat = parseFloat(s.lat);
            if (Number.isNaN(lng) || Number.isNaN(lat)) return;
            const el = document.createElement('div');
            el.className = 'rounded-circle border border-white shadow-sm d-flex align-items-center justify-content-center';
            el.style.width = '26px';
            el.style.height = '26px';
            el.style.fontSize = '11px';
            el.style.fontWeight = '700';
            el.style.background = LINE_COLOR;
            el.style.color = '#fff';
            el.textContent = String(idx + 1);
            const name = escapeHtml(s.name || 'Stop');
            const routeName = escapeHtml(layer.name || '');
            const mk = new mapboxgl.Marker({ element: el })
                .setLngLat([lng, lat])
                .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML('<strong>' + name + '</strong><br><span class="small text-muted">' + routeName + '</span>'))
                .addTo(map);
            markers.push(mk);
        });

        const bounds = new mapboxgl.LngLatBounds();
        if (startPt) bounds.extend(startPt.lngLat);
        if (endPt) bounds.extend(endPt.lngLat);
        if (hasLine) {
            coords.forEach(function (pt) {
                bounds.extend(pt);
            });
        }
        (layer.stops || []).forEach(function (s) {
            const lng = parseFloat(s.lng);
            const lat = parseFloat(s.lat);
            if (!Number.isNaN(lng) && !Number.isNaN(lat)) bounds.extend([lng, lat]);
        });

        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
        } else if (!hasLine && (!(layer.stops || []).length)) {
            map.flyTo({ center: [123.8854, 10.3157], zoom: 10 });
        }
    }

    map.on('load', function () {
        if (!layers.length) {
            if (warnEl) {
                warnEl.textContent = 'No routes to display for this submission.';
                warnEl.classList.remove('d-none');
            }
            return;
        }

        const initialId = routeSelect ? routeSelect.value : String(layers[0].id);
        displayRouteOnMap(initialId);
        syncStopsPanel(initialId);

        if (routeSelect) {
            routeSelect.addEventListener('change', function () {
                displayRouteOnMap(this.value);
                syncStopsPanel(this.value);
            });
        }
    });
})();
</script>
@endpush
