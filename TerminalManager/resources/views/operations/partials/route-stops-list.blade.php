@forelse($groupedByOperator as $operatorId => $operatorRequests)
    @php
        $first = $operatorRequests->first();
        $opLabel = optional($first->operator)->name
            ?? optional($first->operator)->email
            ?? ('Operator #' . $operatorId);
    @endphp

    <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-light d-flex align-items-center gap-2">
            <i class="fas fa-bus text-primary"></i>
            <strong>{{ $opLabel }}</strong>
            <span class="text-muted small ms-1">({{ $operatorRequests->count() }} submission{{ $operatorRequests->count() !== 1 ? 's' : '' }})</span>
        </div>
        <div class="card-body">
            @foreach($operatorRequests as $req)
                @php
                    $statusLabel = match ($req->status) {
                        'pending_sysadmin' => 'pending',
                        'pending_stops' => 'pending stops',
                        default => $req->status,
                    };
                @endphp
                <div class="border rounded p-3 mb-3 @if(!$loop->last) mb-3 @endif">
                    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                        <div>
                            <span class="badge bg-secondary text-uppercase">{{ $req->terminal }} terminal</span>
                            <span class="badge
                                @if($req->status === 'approved') bg-success
                                @elseif($req->status === 'declined') bg-danger
                                @elseif($req->status === 'pending_sysadmin') bg-warning text-dark
                                @else bg-info text-dark @endif">{{ $statusLabel }}</span>
                        </div>
                        <small class="text-muted">#{{ $req->id }} · {{ $req->created_at->diffForHumans() }}</small>
                    </div>

                    <p class="small mb-2 fw-semibold">Routes in this submission — click one to add bus stops on the map:</p>

                    <div class="d-flex flex-wrap gap-2 mb-3">
                        @foreach($routePayloads[$req->id] ?? [] as $pr)
                            @if($req->status === 'pending_stops')
                                <a href="{{ route('terminal.route-stops.edit', ['routeApprovalRequest' => $req->id, 'busRoute' => $pr['id']]) }}" class="btn btn-sm btn-outline-primary">
                                    <i class="fas fa-map-marker-alt me-1"></i> {{ $pr['name'] }}
                                    <span class="text-muted">({{ $pr['code'] }})</span>
                                </a>
                            @else
                                <span class="badge rounded-pill bg-light text-dark border">{{ $pr['name'] }} ({{ $pr['code'] }})</span>
                            @endif
                        @endforeach
                    </div>

                    @if($req->status === 'pending_stops')
                        <form method="post" action="{{ route('terminal.route-stops.submit', $req) }}" class="d-inline js-tm-submit-sysadmin" data-confirm="Send this submission to sysadmin for approval?">
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
            @endforeach
        </div>
    </div>
@empty
    <div class="alert alert-light border mb-0">
        <p class="mb-0 small">
            <strong>No pending requests for {{ strtoupper($terminal) }} terminal.</strong>
            The bus operator must submit from an account whose profile terminal is also <strong>{{ ucfirst($terminal) }}</strong>.
        </p>
    </div>
@endforelse
