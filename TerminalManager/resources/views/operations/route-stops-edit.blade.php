@extends('layouts.app-sidebar')

@section('title', 'Add bus stops')

@section('content')
<div class="container-fluid px-0">
    <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb mb-0">
            <li class="breadcrumb-item"><a href="{{ route('terminal.route-stops') }}">Route stops</a></li>
            <li class="breadcrumb-item active" aria-current="page">{{ $busRoute->name }}</li>
        </ol>
    </nav>

    <div class="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-3">
        <div>
            <h2 class="mb-1 fw-bold">Add bus stops</h2>
            <p class="text-muted small mb-0">
                Submission <strong>#{{ $routeApprovalRequest->id }}</strong> ·
                Operator:
                <strong>{{ optional($routeApprovalRequest->operator)->name ?? optional($routeApprovalRequest->operator)->email ?? ('#' . $routeApprovalRequest->operator_user_id) }}</strong>
                · Route <strong>{{ $busRoute->name }}</strong> ({{ $busRoute->code }})
            </p>
        </div>
        <a href="{{ route('terminal.route-stops') }}" class="btn btn-outline-secondary btn-sm">
            <i class="fas fa-arrow-left me-1"></i> Back to list
        </a>
    </div>

    @if(session('success'))
        <div class="alert alert-success">{{ session('success') }}</div>
    @endif
    @if(session('error'))
        <div class="alert alert-danger">{{ session('error') }}</div>
    @endif
    @if($errors->any())
        <div class="alert alert-danger">
            <ul class="mb-0">@foreach($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul>
        </div>
    @endif

    <div class="card border-0 shadow-sm">
        <div class="card-header bg-light"><strong>Map</strong></div>
        <div class="card-body">
            <p class="small text-muted mb-3">
                Click on the <strong>colored line</strong> along this route to drop stops in order. Save when finished, then return to the list to edit other routes or send to sysadmin.
            </p>

            <div data-tm-stop-editor
                 data-request-id="{{ $routeApprovalRequest->id }}"
                 data-terminal="{{ $routeApprovalRequest->terminal }}"
                 data-single-route="1">
                {{-- Large GeoJSON must not live in data-* attributes (length / escaping breaks JSON.parse) --}}
                <script type="application/json" class="tm-editor-json">
@json(['routesForMap' => $routePayload, 'fullRoutes' => $allRoutePayloads])
                </script>

                <form method="post" action="{{ route('terminal.route-stops.update', $routeApprovalRequest) }}" class="mb-0" data-stops-form="{{ $routeApprovalRequest->id }}">
                    @csrf
                    @method('PUT')

                    <label class="form-label small">Route</label>
                    <select class="form-select form-select-sm mb-2 d-none" data-active-route="{{ $routeApprovalRequest->id }}" aria-hidden="true" tabindex="-1">
                        @foreach($routePayload as $pr)
                            <option value="{{ $pr['id'] }}" selected>{{ $pr['name'] }} ({{ $pr['code'] }}) — {{ $pr['bus_type'] }}</option>
                        @endforeach
                    </select>

                    <div data-tm-map-warning class="alert alert-warning small py-2 d-none mb-2" role="alert"></div>

                    <div class="rounded border mb-2 overflow-hidden tm-map-wrap" style="min-height: 420px; position: relative;">
                        <div data-tm-map="{{ $routeApprovalRequest->id }}" class="tm-map-canvas" style="height: 420px; width: 100%; min-height: 420px;"></div>
                    </div>

                    <div class="d-flex flex-wrap gap-2 mb-2">
                        <button type="button" class="btn btn-sm btn-outline-secondary" data-clear-stops="{{ $routeApprovalRequest->id }}">
                            <i class="fas fa-eraser me-1"></i> Clear stops (this route)
                        </button>
                    </div>

                    <label class="form-label small">Stops for this route (edit names / ETA minutes)</label>
                    <div class="table-responsive mb-2">
                        <table class="table table-sm table-bordered mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th>#</th>
                                    <th>Name</th>
                                    <th>ETA (min)</th>
                                    <th>km from start</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody data-stops-tbody="{{ $routeApprovalRequest->id }}"></tbody>
                        </table>
                    </div>

                    <textarea name="stop_configuration" class="d-none" data-stop-json="{{ $routeApprovalRequest->id }}" rows="3">{{ $initialJson }}</textarea>

                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save me-1"></i> Save all routes for this submission
                    </button>
                </form>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="tmBusStopNameModal" tabindex="-1" aria-labelledby="tmBusStopNameModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-sm rounded-3">
            <div class="modal-header bg-white border-bottom py-3">
                <h5 class="modal-title fw-bold mb-0" id="tmBusStopNameModalLabel">
                    <i class="fas fa-map-marker-alt text-primary me-2"></i> Bus stop name
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body py-4">
                <label for="tmBusStopNameInput" class="form-label">Name (shown to commuters on the map and ticket)</label>
                <input type="text" class="form-control form-control-lg rounded-3" id="tmBusStopNameInput" autocomplete="off" placeholder="e.g. North Terminal, First Stop, Liloan">
                <small class="text-muted d-block mt-3">
                    ETA (minutes) is calculated from <strong>distance along the route</strong> from the terminal. Adjust ETA anytime in the table below before saving.
                </small>
            </div>
            <div class="modal-footer border-top bg-light py-3">
                <button type="button" class="btn btn-secondary rounded-3" data-bs-dismiss="modal" id="tmBusStopNameCancel">
                    Cancel
                </button>
                <button type="button" class="btn btn-primary rounded-3" id="tmBusStopNameSave">
                    <i class="fas fa-plus-circle me-1"></i> Add stop
                </button>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
    window.TM_MAPBOX_TOKEN = @json(config('services.mapbox.token', env('MAPBOX_TOKEN', 'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA')));
</script>
@vite(['resources/js/terminal-route-stops.js'])
@endpush
