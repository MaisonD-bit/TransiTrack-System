@extends('layouts.app')

@section('title', 'Route Approvals')

@section('content')
@php
    $statusLabels = [
        'pending_stops' => 'Pending',
        'pending_sysadmin' => 'Pending',
        'approved' => 'Approved',
        'declined' => 'Declined',
    ];

    $statusBadgeClass = [
        'approved' => 'bg-success',
        'declined' => 'bg-danger',
        'pending_sysadmin' => 'bg-warning text-dark',
        'pending_stops' => 'bg-info text-dark',
    ];
@endphp

<style>
    .route-check-list {
        overflow-x: visible;
    }
    .route-check-list .form-check {
        padding: 0.65rem 1rem 0.65rem 2.25rem;
        margin: 0;
        border-bottom: 1px solid #dee2e6;
        min-height: auto;
    }
    .route-check-list .form-check:last-child {
        border-bottom: none;
    }
    .route-check-list .form-check:hover {
        background-color: #f8f9fa;
    }
    .route-check-list .form-check-input {
        margin-top: 0.2rem;
        margin-left: -1.75rem;
        flex-shrink: 0;
    }
    .route-check-list .form-check-label {
        line-height: 1.4;
        word-break: break-word;
    }
    @media (min-width: 992px) {
        .route-submit-col {
            width: 380px;
            max-width: 380px;
            flex: 0 0 380px;
        }
        .route-submissions-col {
            flex: 1 1 0;
            min-width: 0;
            max-width: calc(100% - 380px - 1.5rem);
        }
    }
    .route-submissions-col .card-body {
        min-width: 0;
        overflow: hidden;
    }
    .submissions-table {
        table-layout: auto;
        width: 100%;
        font-size: 0.9375rem;
        margin-bottom: 0;
    }
    .submissions-table thead th {
        font-weight: 600;
        color: #212529;
        border-bottom: 1px solid #dee2e6;
        padding: 0.65rem 0.75rem;
        vertical-align: middle;
        white-space: nowrap;
    }
    .submissions-table tbody td {
        padding: 0.65rem 0.75rem;
        vertical-align: middle;
        border-bottom: 1px solid #f0f0f0;
    }
    .submissions-table tbody tr:last-child td {
        border-bottom: none;
    }
    .submissions-table .col-id,
    .submissions-table .col-terminal,
    .submissions-table .col-status {
        width: 1%;
        white-space: nowrap;
    }
    .submissions-table .col-terminal {
        text-transform: uppercase;
        font-weight: 500;
    }
    .submissions-table thead .col-routes,
    .submissions-table tbody .col-routes {
        max-width: 9rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.35;
        padding-left: 1.75rem;
    }
    .submissions-table .col-spacer {
        width: 100%;
        padding: 0 !important;
        border: none !important;
    }
    .submissions-table thead .col-submitted,
    .submissions-table tbody .col-submitted {
        text-align: right;
        padding-left: 2.5rem;
        padding-right: 1.25rem;
        white-space: nowrap;
        color: #6c757d;
        font-size: 0.875rem;
        width: 1%;
    }
    .submissions-table .status-badge {
        font-size: 0.75rem;
        font-weight: 500;
        padding: 0.3em 0.55em;
        white-space: nowrap;
        vertical-align: middle;
    }
    .submissions-table thead .col-actions {
        text-align: center !important;
        padding-left: 0.5rem;
        padding-right: 1rem;
        width: 1%;
    }
    .submissions-table tbody .col-actions {
        text-align: center;
        padding-right: 1rem;
        white-space: nowrap;
        width: 1%;
    }
    .submissions-table .action-group {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        flex-wrap: nowrap;
    }
    .submissions-table .col-actions .btn {
        font-size: 0.8125rem;
        padding: 0.25rem 0.5rem;
    }
    .submissions-card-header .schedule-note {
        font-size: 0.8125rem;
    }
    .route-submit-card .card-body {
        padding: 1.15rem 1.25rem;
    }
    .route-submit-card .card-header {
        padding-top: 0.75rem;
        padding-bottom: 0.75rem;
    }
    .route-submit-card .card-header h5 {
        font-size: 1rem;
    }
    .route-terminal-box {
        padding: 0.75rem !important;
        margin-bottom: 1rem !important;
    }
    .route-terminal-box .terminal-icon {
        width: 36px;
        height: 36px;
    }
</style>

<div class="container-fluid">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div class="d-flex align-items-center">
            <i class="fas fa-code-branch me-3 text-primary fs-4"></i>
            <div>
                <h2 class="mb-0 fw-bold">Route Approvals</h2>
                <p class="text-muted small mb-0">
                    Submit routes for your terminal, add bus stops on the map, then send to sysadmin for approval.
                </p>
            </div>
        </div>
        <a href="{{ route('route-stops.index') }}" class="btn btn-sm btn-outline-primary">
            <i class="fas fa-map-marker-alt me-1"></i> Route stops
        </a>
    </div>

    @if(session('success'))
        <div class="alert alert-success alert-dismissible fade show" role="alert">
            {{ session('success') }}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    @endif
    @if(session('error'))
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            {{ session('error') }}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    @endif
    @if($errors->any())
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            <ul class="mb-0">@foreach($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    @endif

    <div class="row g-4">
        <!-- Submit routes -->
        <div class="col-12 col-lg-auto route-submit-col">
            <div class="card border-0 shadow-sm h-100 route-submit-card">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0">
                        <i class="fas fa-paper-plane me-2"></i>Submit routes
                    </h5>
                </div>
                <div class="card-body">
                    @if($operatorTerminal === 'north' || $operatorTerminal === 'south')
                        <div class="d-flex align-items-center gap-2 p-2 rounded bg-light border route-terminal-box">
                            <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 terminal-icon"
                                 style="background-color: #edf2f7;">
                                <i class="fas fa-building text-primary"></i>
                            </div>
                            <div>
                                <div class="fw-semibold small">{{ ucfirst($operatorTerminal) }} terminal</div>
                                <div class="text-muted" style="font-size: 0.8rem;">Submissions go to this terminal.</div>
                            </div>
                        </div>
                    @else
                        <div class="alert alert-warning mb-4">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Terminal not set.</strong> An administrator must assign North or South on your profile before you can submit routes.
                        </div>
                    @endif

                    @error('terminal')
                        <div class="alert alert-danger small">{{ $message }}</div>
                    @enderror

                    <form method="post" action="{{ route('route-requests.store') }}" id="route-request-form">
                        @csrf
                        <div class="mb-3">
                            <label class="form-label fw-semibold small mb-2">Select routes</label>
                            @if($routes->isEmpty())
                                <div class="text-center py-4 text-muted border rounded bg-light">
                                    <i class="fas fa-route fa-2x mb-2 opacity-50"></i>
                                    <p class="small mb-0">No routes available. Routes are managed by sysadmin.</p>
                                </div>
                            @else
                                <div class="border rounded bg-white route-check-list" style="max-height: 300px; overflow-y: auto;">
                                    @foreach($routes as $r)
                                        <div class="form-check">
                                            <input class="form-check-input route-checkbox"
                                                   type="checkbox"
                                                   name="route_ids[]"
                                                   value="{{ $r->id }}"
                                                   id="route_cb_{{ $r->id }}"
                                                   @checked(collect(old('route_ids', []))->contains($r->id))>
                                            <label class="form-check-label" for="route_cb_{{ $r->id }}">
                                                {{ $r->name }}
                                                <span class="text-muted">({{ $r->code }})</span>
                                            </label>
                                        </div>
                                    @endforeach
                                </div>
                                <small class="text-muted d-block mt-2">Select one or more routes to submit.</small>
                            @endif
                        </div>
                        <div class="d-grid">
                            <button type="submit"
                                    class="btn btn-primary"
                                    @if($routes->isEmpty() || ! ($operatorTerminal === 'north' || $operatorTerminal === 'south')) disabled @endif>
                                <i class="fas fa-paper-plane me-2"></i>Submit routes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Submissions table -->
        <div class="col-lg route-submissions-col">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-primary text-white py-2 d-flex justify-content-between align-items-center flex-wrap gap-2 submissions-card-header">
                    <h5 class="mb-0" style="font-size: 1rem;">
                        <i class="fas fa-list me-2"></i>Your submissions
                    </h5>
                    <span class="schedule-note text-white-50">
                        Approved routes appear in
                        <a href="{{ route('schedule.panel') }}" class="text-white text-decoration-underline">Schedule</a>
                    </span>
                </div>
                <div class="card-body p-0">
                    @if($requests->isEmpty())
                        <div class="text-center py-5 text-muted">
                            <i class="fas fa-inbox fa-3x mb-3 opacity-50"></i>
                            <p class="mb-0">No submissions yet. Select routes and submit using the form.</p>
                        </div>
                    @else
                        <table class="table align-middle mb-0 submissions-table">
                            <thead class="table-light">
                                <tr>
                                    <th class="ps-3 col-id">#</th>
                                    <th class="col-terminal">Terminal</th>
                                    <th class="col-status">Status</th>
                                    <th class="col-routes">Routes</th>
                                    <th class="col-spacer" aria-hidden="true"></th>
                                    <th class="col-submitted">Submitted</th>
                                    <th class="col-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach($requests as $req)
                                    @php
                                        $names = \App\Models\Route::whereIn('id', $req->route_ids ?? [])->pluck('name');
                                        $routeLabel = $names->join(', ') ?: '—';
                                        $submittedLabel = $req->created_at->diffForHumans();
                                    @endphp
                                    <tr>
                                        <td class="ps-3 col-id">{{ $req->id }}</td>
                                        <td class="col-terminal">{{ $req->terminal }}</td>
                                        <td class="col-status">
                                            <span class="badge rounded-pill status-badge {{ $statusBadgeClass[$req->status] ?? 'bg-secondary' }}">
                                                {{ $statusLabels[$req->status] ?? ucwords(str_replace('_', ' ', $req->status)) }}
                                            </span>
                                        </td>
                                        <td class="col-routes" title="{{ $routeLabel }}">{{ $routeLabel }}</td>
                                        <td class="col-spacer" aria-hidden="true"></td>
                                        <td class="col-submitted">{{ $submittedLabel }}</td>
                                        <td class="col-actions">
                                            @if($req->status === 'pending_stops')
                                                <div class="action-group">
                                                    <a href="{{ route('route-stops.index') }}" class="btn btn-sm btn-primary">
                                                        <i class="fas fa-map-marker-alt me-1"></i>Add stops
                                                    </a>
                                                    <form method="post"
                                                          action="{{ route('route-requests.destroy', $req) }}"
                                                          class="d-inline cancel-submission-form">
                                                        @csrf
                                                        @method('DELETE')
                                                        <button type="button"
                                                                class="btn btn-sm btn-outline-danger js-cancel-submission-btn">
                                                            <i class="fas fa-times me-1"></i>Cancel
                                                        </button>
                                                    </form>
                                                </div>
                                            @else
                                                <span class="text-muted">—</span>
                                            @endif
                                        </td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="cancelSubmissionModal" tabindex="-1" aria-labelledby="cancelSubmissionModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-danger">
            <div class="modal-header bg-danger text-white">
                <h5 class="modal-title" id="cancelSubmissionModalLabel">
                    <i class="fas fa-exclamation-triangle me-2"></i>Cancel submission
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <p class="mb-0">Are you sure you want to cancel this route submission? <strong>This cannot be undone.</strong></p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    <i class="fas fa-times me-1"></i> Keep submission
                </button>
                <button type="button" class="btn btn-danger" id="confirmCancelSubmissionBtn">
                    <i class="fas fa-times me-1"></i> Cancel submission
                </button>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
(function () {
    const form = document.getElementById('route-request-form');
    if (form) {
        form.addEventListener('submit', function (e) {
            const checked = form.querySelectorAll('.route-checkbox:checked');
            if (checked.length === 0) {
                e.preventDefault();
                alert('Select at least one route.');
            }
        });
    }

    const cancelModalEl = document.getElementById('cancelSubmissionModal');
    const confirmCancelBtn = document.getElementById('confirmCancelSubmissionBtn');
    if (!cancelModalEl || !confirmCancelBtn) return;

    const cancelModal = new bootstrap.Modal(cancelModalEl);
    let pendingCancelForm = null;

    document.querySelectorAll('.js-cancel-submission-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            pendingCancelForm = btn.closest('.cancel-submission-form');
            cancelModal.show();
        });
    });

    confirmCancelBtn.addEventListener('click', function () {
        if (pendingCancelForm) {
            pendingCancelForm.submit();
        }
    });

    cancelModalEl.addEventListener('hidden.bs.modal', function () {
        pendingCancelForm = null;
    });
})();
</script>
@endpush
