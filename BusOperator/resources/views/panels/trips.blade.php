@extends('layouts.app')

@section('title', 'Trip Logs')

@section('content')
<div class="container-fluid">
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div class="d-flex align-items-center">
            <i class="fas fa-clipboard-list me-3 text-primary fs-4"></i>
            <div>
                <h2 class="mb-0 fw-bold">Trip Logs</h2>
                <p class="text-muted small mb-0">Daily routes, tickets, passengers boarded, and revenue</p>
            </div>
        </div>
        <form method="get" action="{{ route('trips.panel') }}" class="d-flex align-items-center gap-2">
            <label for="trip_date" class="small text-muted mb-0">Date</label>
            <input type="date" name="date" id="trip_date" class="form-control form-control-sm" value="{{ $date }}">
            <button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-filter me-1"></i> Apply</button>
        </form>
    </div>

    <div class="row mb-4">
        <div class="col-lg-4 mb-3">
            <div class="card border-0 shadow-sm h-100 border-start border-success border-4">
                <div class="card-body">
                    <div class="text-muted small">Total revenue (selected day)</div>
                    <div class="fs-3 fw-bold text-success">₱ {{ number_format($totalRevenue, 2) }}</div>
                </div>
            </div>
        </div>
        <div class="col-lg-8 mb-3">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-white py-2 d-flex justify-content-between align-items-center">
                    <span class="fw-semibold"><i class="fas fa-map-marked-alt me-2 text-primary"></i> Operations map</span>
                    <small class="text-muted">Incident locations can be cross-checked here (per advisory)</small>
                </div>
                <div class="card-body p-0">
                    <div id="tripMap" style="height: 280px; width: 100%;"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="card border-0 shadow-sm">
        <div class="card-header bg-light d-flex justify-content-between align-items-center">
            <h5 class="mb-0"><i class="fas fa-list me-2"></i> Trip logs of the day</h5>
            <span class="badge bg-primary">{{ \Carbon\Carbon::parse($date)->format('M d, Y') }}</span>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Route</th>
                            <th>Driver</th>
                            <th>Date</th>
                            <th>Passengers</th>
                            <th>Ticket ID (sample)</th>
                            <th>Tickets</th>
                            <th>Revenue</th>
                            <th>Company / type</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($tripRows as $row)
                            <tr>
                                <td class="fw-semibold">{{ $row['route_name'] }}</td>
                                <td>{{ $row['driver_name'] }}</td>
                                <td>{{ $date }}</td>
                                <td>
                                    <span class="badge bg-info text-dark">{{ $row['boarded'] }} / {{ $row['capacity'] ?: '—' }}</span>
                                </td>
                                <td class="small font-monospace">{{ $row['ticket_id_sample'] }}</td>
                                <td><span class="text-muted">{{ $row['ticket_count'] }} issued</span></td>
                                <td class="fw-semibold">₱ {{ number_format($row['revenue'], 2) }}</td>
                                <td>
                                    <small class="d-block">{{ $row['bus_company'] }}</small>
                                    <small class="text-muted">{{ $row['bus_type'] }}</small>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="8" class="text-center py-5 text-muted">
                                    <i class="fas fa-calendar-times fa-2x mb-2 d-block"></i>
                                    No schedules for this date. Create schedules in the Schedule panel.
                                </td>
                            </tr>
                        @endforelse
                    </tbody>
                    @if($tripRows->isNotEmpty())
                    <tfoot class="table-light">
                        <tr>
                            <th colspan="6" class="text-end">AMOUNT =</th>
                            <th class="text-success">₱ {{ number_format($totalRevenue, 2) }}</th>
                            <th></th>
                        </tr>
                    </tfoot>
                    @endif
                </table>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', function () {
    if (typeof mapboxgl === 'undefined') return;
    const center = @json($mapCenter);
    const map = new mapboxgl.Map({
        container: 'tripMap',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: center,
        zoom: 11
    });
    map.addControl(new mapboxgl.NavigationControl());
    new mapboxgl.Marker({ color: '#3498db' }).setLngLat(center).addTo(map);
});
</script>
@endpush
