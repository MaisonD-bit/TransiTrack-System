@extends('layouts.app')

@section('title', 'Dashboard')

@section('content')
<div class="container-fluid"
     data-dashboard-poll-url="{{ route('sysadmin.dashboard.poll') }}"
     data-dashboard-poll-signature="{{ $pollSignature ?? '' }}">
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div class="d-flex align-items-center">
            <i class="fas fa-tachometer-alt me-3 text-primary fs-4"></i>
            <h2 class="mb-0 fw-bold">Sysadmin Dashboard</h2>
        </div>
        <div class="d-flex gap-2">
            <button type="button" class="btn btn-outline-primary btn-sm" onclick="refreshDashboard()">
                <i class="fas fa-sync-alt me-1"></i> Refresh
            </button>
            <a href="{{ route('sysadmin.approvals') }}" class="btn btn-primary btn-sm">
                <i class="fas fa-check-double me-1"></i> Review queue
            </a>
        </div>
    </div>

    @if(session('success'))
        <div class="alert alert-success">{{ session('success') }}</div>
    @endif

    @if(!$needsAction)
        <div class="alert alert-success alert-sm py-2 mb-4">
            <i class="fas fa-check-circle me-2"></i>
            <small><strong>All caught up.</strong> No route packages or manager accounts are waiting for your decision.</small>
        </div>
    @endif

    <!-- Summary cards -->
    <div class="row mb-4">
        <div class="col-lg-3 col-md-6 mb-3">
            <div class="card border-warning border-2 bg-white shadow-sm h-100 dashboard-card" onclick="redirectTo('{{ route('sysadmin.approvals') }}')">
                <div class="card-body text-center">
                    <div class="mb-3">
                        <i class="fas fa-route fs-1 text-warning"></i>
                    </div>
                    <h2 id="dash-stat-pending-routes" class="fw-bold text-dark mb-1">{{ $pendingRouteCount }}</h2>
                    <p class="text-muted mb-0">Route approvals</p>
                    <small class="text-warning">Click to review</small>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 mb-3">
            <div class="card border-primary border-2 bg-white shadow-sm h-100 dashboard-card" onclick="redirectTo('{{ route('sysadmin.manager-approvals', ['status' => 'inactive']) }}')">
                <div class="card-body text-center">
                    <div class="mb-3">
                        <i class="fas fa-user-tie fs-1 text-primary"></i>
                    </div>
                    <h2 id="dash-stat-pending-managers" class="fw-bold text-dark mb-1">{{ $pendingManagerCount }}</h2>
                    <p class="text-muted mb-0">Pending managers</p>
                    <small class="text-primary">Click to manage</small>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 mb-3">
            <div class="card border-info border-2 bg-white shadow-sm h-100">
                <div class="card-body text-center">
                    <div class="mb-3">
                        <i class="fas fa-map-marker-alt fs-1 text-info"></i>
                    </div>
                    <h2 id="dash-stat-pending-stops" class="fw-bold text-dark mb-1">{{ $pendingStopsCount }}</h2>
                    <p class="text-muted mb-0">With bus operators</p>
                    <small class="text-info">Awaiting stop mapping</small>
                </div>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 mb-3">
            <div class="card border-success border-2 bg-white shadow-sm h-100 dashboard-card" onclick="document.getElementById('recentDecisionsSection')?.scrollIntoView({ behavior: 'smooth' })">
                <div class="card-body text-center">
                    <div class="mb-3">
                        <i class="fas fa-gavel fs-1 text-success"></i>
                    </div>
                    <h2 id="dash-stat-decisions-today" class="fw-bold text-dark mb-1">{{ $decisionsToday }}</h2>
                    <p class="text-muted mb-0">Decisions today</p>
                    <small class="text-success">Click to view below</small>
                </div>
            </div>
        </div>
    </div>


    <!-- Pending approvals -->
    <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-light d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h5 class="mb-0"><i class="fas fa-inbox me-2"></i>Pending approvals</h5>
            <div class="d-flex gap-2 align-items-center">
                <a href="{{ route('sysadmin.manager-approvals', ['status' => 'inactive']) }}" class="btn btn-outline-secondary btn-sm">
                    <i class="fas fa-user-tie me-1"></i> Managers
                </a>
                <a href="{{ route('sysadmin.approvals') }}" class="btn btn-primary btn-sm">
                    <i class="fas fa-check-double me-1"></i> Full queue
                </a>
            </div>
        </div>
        <div class="card-body">
            @if($pendingQueue->count() > 0)
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>ID</th>
                            <th>Operator</th>
                            <th>Terminal</th>
                            <th>Routes</th>
                            <th>Submitted</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="dash-pending-queue-tbody">
                        @include('dashboard.partials.pending-queue-tbody', ['pendingQueue' => $pendingQueue])
                    </tbody>
                </table>
            </div>
            @else
            <div class="text-center py-5">
                <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                <h4 class="text-muted">No pending route approvals</h4>
                <p class="text-muted">Route packages will appear here after bus operators add stops and submit for sysadmin review.</p>
                <a href="{{ route('sysadmin.manager-approvals', ['status' => 'inactive']) }}" class="btn btn-outline-primary me-2">
                    <i class="fas fa-user-tie me-1"></i> Manager approvals
                </a>
            </div>
            @endif
        </div>
    </div>

    <!-- Recent decisions + quick info -->
    <div class="row" id="recentDecisionsSection">
        <div class="col-lg-8 mb-4 mb-lg-0">
            <div class="card border-0 shadow-sm h-100">
                <div class="card-header bg-light d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h5 class="mb-0"><i class="fas fa-history me-2"></i>Recent decisions</h5>
                    <select id="decisionFilter" class="form-select form-select-sm" style="width: 150px;">
                        <option value="">All decisions</option>
                        <option value="approved">Approved</option>
                        <option value="declined">Declined</option>
                    </select>
                </div>
                <div class="card-body">
                    @if($recentDecisions->count() > 0)
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0" id="decisionsTable">
                            <thead class="table-light">
                                <tr>
                                    <th>ID</th>
                                    <th>Operator</th>
                                    <th>Terminal</th>
                                    <th>Routes</th>
                                    <th>Decision</th>
                                    <th>When</th>
                                </tr>
                            </thead>
                            <tbody id="dash-recent-decisions-tbody">
                                @include('dashboard.partials.recent-decisions-tbody', ['recentDecisions' => $recentDecisions])
                            </tbody>
                        </table>
                    </div>
                    @else
                    <div class="text-center py-4 text-muted">
                        <i class="fas fa-history fa-2x mb-2"></i>
                        <p class="mb-0">No route decisions recorded yet.</p>
                    </div>
                    @endif
                </div>
            </div>
        </div>
        <div class="col-lg-4">
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><i class="fas fa-info-circle me-2"></i>Quick info</h6>
                </div>
                <div class="card-body">
                    <div class="alert alert-warning alert-sm py-2 mb-2">
                        <i class="fas fa-inbox me-2"></i>
                        <small><strong>{{ $pendingRouteCount }}</strong> route package(s) in your queue</small>
                    </div>
                    <div class="alert alert-primary alert-sm py-2 mb-2">
                        <i class="fas fa-user-tie me-2"></i>
                        <small><strong>{{ $pendingManagerCount }}</strong> manager account(s) awaiting activation</small>
                    </div>
                    <div class="alert alert-info alert-sm py-2 mb-0">
                        <i class="fas fa-map-marker-alt me-2"></i>
                        <small><strong>{{ $pendingStopsCount }}</strong> with bus operators (adding stops)</small>
                    </div>
                </div>
            </div>
            <div class="card border-0 shadow-sm">
                <div class="card-header bg-light">
                    <h6 class="mb-0"><i class="fas fa-building me-2"></i>Queue by terminal</h6>
                </div>
                <div id="dash-terminal-badges" class="card-body">
                    @include('dashboard.partials.terminal-badges', ['pendingByTerminal' => $pendingByTerminal])
                </div>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
@vite('resources/js/dashboard.js')
@endpush

