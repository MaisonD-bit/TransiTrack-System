@extends('layouts.app')

@section('title', 'Trip Logs')

@section('content')
@php
    $incidentCount = count($incidentMarkers ?? []);
    $tripCount = $tripRows->count();
@endphp
<div class="container-fluid">
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div class="d-flex align-items-center">
            <i class="fas fa-clipboard-list me-3 text-primary fs-4"></i>
            <div>
                <h2 class="mb-0 fw-bold">Trip Logs</h2>
                <p class="text-muted small mb-0">Daily routes, tickets, passengers aboard, and revenue</p>
            </div>
        </div>
        <form method="get" action="{{ route('trips.panel') }}" class="d-flex align-items-center gap-2 flex-wrap">
            <label for="trip_date" class="small text-muted mb-0">Date</label>
            <input type="date" name="date" id="trip_date" class="form-control form-control-sm" value="{{ $date }}">
            <button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-filter me-1"></i> Apply</button>
        </form>
    </div>

    <div class="row mb-4">
        <div class="col-md-4 mb-3">
            <div class="card border-0 shadow-sm h-100 border-start border-success border-4">
                <div class="card-body">
                    <div class="text-muted small">Total revenue (selected day)</div>
                    <div class="fs-3 fw-bold text-success" id="tripTotalRevenue">₱ {{ number_format($totalRevenue, 2) }}</div>
                </div>
            </div>
        </div>
        <div class="col-md-4 mb-3">
            <div class="card border-0 shadow-sm h-100 border-start border-danger border-4">
                <div class="card-body">
                    <div class="text-muted small">Driver incidents (this date)</div>
                    <div class="fs-3 fw-bold text-danger"><span id="tripIncidentCount">{{ $incidentCount }}</span></div>
                </div>
            </div>
        </div>
        <div class="col-md-4 mb-3">
            <div class="card border-0 shadow-sm h-100 border-start border-primary border-4">
                <div class="card-body">
                    <div class="text-muted small">Trip rows (table)</div>
                    <div class="fs-3 fw-bold text-primary"><span id="tripScheduleCount">{{ $tripCount }}</span></div>
                </div>
            </div>
        </div>
    </div>

    <div class="card border-0 shadow-sm">
        <div class="card-header bg-light">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h5 class="mb-0"><i class="fas fa-list me-2"></i> Trip logs of the day</h5>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <small class="text-muted" id="tripLogsLiveStatus" title="Refreshes every 10 seconds while this tab is open">Live sync on</small>
                    <span class="badge bg-primary">{{ \Carbon\Carbon::parse($date)->format('M d, Y') }}</span>
                </div>
            </div>
            <p class="small text-muted mb-0 mt-2">Passengers shows who is still aboard. Tickets and revenue count every paid sale and do not drop when someone gets off.</p>
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
                    <tbody id="tripLogsTbody">
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
                    <tfoot class="table-light" id="tripLogsTfoot" style="{{ $tripRows->isEmpty() ? 'display: none;' : '' }}">
                        <tr>
                            <th colspan="6" class="text-end">AMOUNT =</th>
                            <th class="text-success" id="tripLogsFootAmount">₱ {{ number_format($totalRevenue, 2) }}</th>
                            <th></th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', function () {
    const pollUrl = @json(route('trips.panel.poll'));
    let lastChecksum = @json($tripPollChecksum ?? '');
    const dateInput = document.getElementById('trip_date');
    const revEl = document.getElementById('tripTotalRevenue');
    const tbody = document.getElementById('tripLogsTbody');
    const tfoot = document.getElementById('tripLogsTfoot');
    const footAmt = document.getElementById('tripLogsFootAmount');
    const liveEl = document.getElementById('tripLogsLiveStatus');
    const incidentCountEl = document.getElementById('tripIncidentCount');
    const scheduleCountEl = document.getElementById('tripScheduleCount');

    function esc(s) {
        if (s == null || s === '') return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatMoney(n) {
        const x = Number(n);
        if (Number.isNaN(x)) return '0.00';
        return x.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function renderTripTable(rows, totalRevenue) {
        if (!tbody) return;
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">' +
                '<i class="fas fa-calendar-times fa-2x mb-2 d-block"></i>' +
                'No schedules for this date. Create schedules in the Schedule panel.</td></tr>';
            if (tfoot) tfoot.style.display = 'none';
            return;
        }
        tbody.innerHTML = rows.map(function (r) {
            const cap = r.capacity ? r.capacity : '—';
            return '<tr>' +
                '<td class="fw-semibold">' + esc(r.route_name) + '</td>' +
                '<td>' + esc(r.driver_name) + '</td>' +
                '<td>' + esc(dateInput && dateInput.value ? dateInput.value : '') + '</td>' +
                '<td><span class="badge bg-info text-dark">' + esc(String(r.boarded)) + ' / ' + esc(String(cap)) + '</span></td>' +
                '<td class="small font-monospace">' + esc(r.ticket_id_sample) + '</td>' +
                '<td><span class="text-muted">' + esc(String(r.ticket_count)) + ' issued</span></td>' +
                '<td class="fw-semibold">₱ ' + formatMoney(r.revenue) + '</td>' +
                '<td><small class="d-block">' + esc(r.bus_company) + '</small>' +
                '<small class="text-muted">' + esc(r.bus_type) + '</small></td>' +
                '</tr>';
        }).join('');
        if (tfoot) tfoot.style.display = '';
        if (footAmt) footAmt.textContent = '₱ ' + formatMoney(totalRevenue);
    }

    function applyPollPayload(data) {
        if (!data || !data.success) return;
        if (data.checksum === lastChecksum) {
            if (liveEl) liveEl.textContent = 'Live sync · checked ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return;
        }
        lastChecksum = data.checksum;
        if (revEl) revEl.textContent = '₱ ' + formatMoney(data.totalRevenue);
        renderTripTable(data.rows || [], data.totalRevenue);
        if (scheduleCountEl && data.rows) scheduleCountEl.textContent = String(data.rows.length);
        if (incidentCountEl && data.incidentMarkers) {
            incidentCountEl.textContent = String(data.incidentMarkers.length);
        }
        if (liveEl) liveEl.textContent = 'Live sync · updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function pollOnce() {
        const d = dateInput && dateInput.value ? dateInput.value : '';
        const url = pollUrl + (d ? ('?date=' + encodeURIComponent(d)) : '');
        fetch(url, {
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
        })
            .then(function (r) { return r.json(); })
            .then(applyPollPayload)
            .catch(function () {
                if (liveEl) liveEl.textContent = 'Live sync paused (connection error)';
            });
    }

    setInterval(pollOnce, 10000);
    pollOnce();
});
</script>
@endpush
