@extends('layouts.app')

@section('title', 'Route & stop approval flow')

@section('content')
<div class="container-fluid">
    <div class="d-flex align-items-center mb-4">
        <i class="fas fa-code-branch me-3 text-primary fs-4"></i>
        <div>
            <h2 class="mb-0 fw-bold">Routes for sysadmin approval</h2>
            <p class="text-muted small mb-0">
                Choose routes for your terminal, then add bus stops on the map under <strong>Route stops</strong>. When ready, send to TransiTrack sysadmin for approval.
            </p>
        </div>
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

    <div class="row g-4">
        <div class="col-lg-5">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-light"><strong>1.</strong> Choose routes for your terminal</div>
                <div class="card-body">
                    @if($operatorTerminal === 'north' || $operatorTerminal === 'south')
                        <div class="alert alert-light border py-2 small mb-3">
                            <strong>Your terminal:</strong> {{ ucfirst($operatorTerminal) }}
                            <span class="text-muted d-block mt-1">Submissions always go to this terminal; you cannot choose the other side.</span>
                        </div>
                    @else
                        <div class="alert alert-warning small mb-3">
                            <strong>Terminal not set on your account.</strong> An administrator must assign North or South on your profile before you can submit routes here.
                        </div>
                    @endif

                    @error('terminal')
                        <div class="alert alert-danger small">{{ $message }}</div>
                    @enderror

                    <form method="post" action="{{ route('route-requests.store') }}" id="route-request-form">
                        @csrf
                        <div class="mb-3">
                            <label class="form-label">Routes</label>
                            @if($routes->isEmpty())
                                <p class="text-muted small mb-0">No routes available — create routes first under <strong>Routes</strong>.</p>
                            @else
                                <div class="border rounded p-2 bg-light" style="max-height: 280px; overflow-y: auto;">
                                    @foreach($routes as $r)
                                        <div class="form-check py-1">
                                            <input class="form-check-input route-checkbox"
                                                   type="checkbox"
                                                   name="route_ids[]"
                                                   value="{{ $r->id }}"
                                                   id="route_cb_{{ $r->id }}"
                                                   @checked(collect(old('route_ids', []))->contains($r->id))>
                                            <label class="form-check-label" for="route_cb_{{ $r->id }}">
                                                {{ $r->name }} <span class="text-muted">({{ $r->code }})</span>
                                            </label>
                                        </div>
                                    @endforeach
                                </div>
                                <small class="text-muted d-block mt-1">Select one or more routes.</small>
                            @endif
                        </div>
                        <button type="submit" class="btn btn-primary" @if($routes->isEmpty() || ! ($operatorTerminal === 'north' || $operatorTerminal === 'south')) disabled @endif>
                            <i class="fas fa-paper-plane me-1"></i> Submit routes
                        </button>
                    </form>
                </div>
            </div>
        </div>
        <div class="col-lg-7">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-light"><strong>2. Your submissions</strong> — status</div>
                <div class="card-body">
                    <p class="small text-muted">
                        After you add stops and sysadmin approves, these routes become available when you
                        <a href="{{ route('schedule.panel') }}">schedule drivers</a>.
                    </p>
                    @if($requests->isEmpty())
                        <p class="text-muted mb-0">No requests yet. Submit routes using the form.</p>
                    @else
                        <div class="table-responsive">
                            <table class="table table-sm align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>#</th>
                                        <th>Terminal</th>
                                        <th>Status</th>
                                        <th>Routes</th>
                                        <th>Submitted</th>
                                        <th class="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($requests as $req)
                                        <tr>
                                            <td>{{ $req->id }}</td>
                                            <td class="text-uppercase">{{ $req->terminal }}</td>
                                            <td>
                                                <span class="badge
                                                    @if($req->status === 'approved') bg-success
                                                    @elseif($req->status === 'declined') bg-danger
                                                    @elseif($req->status === 'pending_sysadmin') bg-warning text-dark
                                                    @elseif($req->status === 'pending_stops') bg-info text-dark
                                                    @else bg-secondary @endif">{{ $req->status }}</span>
                                            </td>
                                            <td class="small">
                                                @php
                                                    $names = \App\Models\Route::whereIn('id', $req->route_ids ?? [])->pluck('name');
                                                @endphp
                                                {{ $names->join(', ') ?: '—' }}
                                            </td>
                                            <td class="small text-muted">{{ $req->created_at->diffForHumans() }}</td>
                                            <td class="text-end text-nowrap">
                                                @if($req->status === 'pending_stops')
                                                    <a href="{{ route('route-stops.index') }}" class="btn btn-sm btn-primary me-1">
                                                        <i class="fas fa-map-marker-alt me-1"></i> Add stops
                                                    </a>
                                                    <form method="post"
                                                          action="{{ route('route-requests.destroy', $req) }}"
                                                          class="d-inline"
                                                          onsubmit="return confirm('Cancel this submission?');">
                                                        @csrf
                                                        @method('DELETE')
                                                        <button type="submit" class="btn btn-sm btn-outline-danger">
                                                            <i class="fas fa-times me-1"></i> Cancel
                                                        </button>
                                                    </form>
                                                @else
                                                    <span class="text-muted small">—</span>
                                                @endif
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
(function () {
    const form = document.getElementById('route-request-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
        const checked = form.querySelectorAll('.route-checkbox:checked');
        if (checked.length === 0) {
            e.preventDefault();
            alert('Select at least one route.');
        }
    });
})();
</script>
@endpush
