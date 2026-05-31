{{-- Route stops submission list (included on route-stops page + returned by pollList JSON). --}}
@forelse($requests as $req)
    @php
        $statusLabel = match ($req->status) {
            'pending_sysadmin' => 'pending sysadmin',
            'pending_stops' => 'add stops',
            default => $req->status,
        };
    @endphp
    <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-light d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
                <strong>Submission #{{ $req->id }}</strong>
                @if($operatorTerminal)
                    <span class="badge bg-secondary text-uppercase ms-1">{{ $operatorTerminal }} terminal</span>
                @endif
                <span class="badge ms-1
                    @if($req->status === 'approved') bg-success
                    @elseif($req->status === 'declined') bg-danger
                    @elseif($req->status === 'pending_sysadmin') bg-warning text-dark
                    @else bg-info text-dark @endif">{{ $statusLabel }}</span>
            </div>
            <small class="text-muted">{{ $req->created_at->diffForHumans() }}</small>
        </div>
        <div class="card-body">
            <p class="small mb-2 fw-semibold">Routes in this submission — click one to add bus stops on the map:</p>

            <div class="d-flex flex-wrap gap-2 mb-3">
                @foreach($routePayloads[$req->id] ?? [] as $pr)
                    @if($req->status === 'pending_stops')
                        <a href="{{ route('route-stops.edit', ['routeApprovalRequest' => $req->id, 'route' => $pr['id']]) }}" class="btn btn-sm btn-outline-primary">
                            <i class="fas fa-map-marker-alt me-1"></i> {{ $pr['name'] }}
                            <span class="text-muted">({{ $pr['code'] }})</span>
                        </a>
                    @else
                        <span class="badge rounded-pill bg-light text-dark border">{{ $pr['name'] }} ({{ $pr['code'] }})</span>
                    @endif
                @endforeach
            </div>

            @if($req->status === 'pending_stops')
                <form method="post" action="{{ route('route-stops.submit', $req) }}" class="d-inline js-bo-submit-sysadmin" data-confirm="Send this submission to sysadmin for approval?">
                    @csrf
                    <button type="submit" class="btn btn-sm btn-warning text-dark" @if(empty($req->stop_configuration)) disabled title="Save stops for each route first" @endif>
                        <i class="fas fa-user-shield me-1"></i> Send submission #{{ $req->id }} to sysadmin
                    </button>
                </form>
            @elseif($req->status === 'pending_sysadmin')
                <p class="small text-muted mb-0"><i class="fas fa-hourglass-half me-1"></i> Waiting for TransiTrack sysadmin approval.</p>
            @endif

            @if($req->stop_configuration)
                <details class="mt-2"><summary class="small">View saved stop data</summary>
                    <pre class="small bg-light p-2 rounded mt-1 mb-0" style="max-height: 160px; overflow: auto;">{{ json_encode($req->stop_configuration, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) }}</pre>
                </details>
            @endif
        </div>
    </div>
@empty
    <div class="alert alert-light border mb-0">
        <p class="mb-0 small">
            <strong>No submissions waiting for stops.</strong>
            Submit routes from <a href="{{ route('route-requests.panel') }}">Route requests</a>, then return here to add bus stops on the map.
        </p>
    </div>
@endforelse
