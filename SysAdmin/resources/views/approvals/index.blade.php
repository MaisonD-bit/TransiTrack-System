@extends('layouts.app')

@section('title', 'Route approvals')

@section('content')
<div class="container-fluid">
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div class="d-flex align-items-center">
            <i class="fas fa-check-double me-3 text-primary fs-4"></i>
            <div>
                <h2 class="mb-0 fw-bold">Route &amp; stop approvals</h2>
                <p class="text-muted small mb-0">Approve packages submitted by terminal managers. This list refreshes automatically every few seconds.</p>
            </div>
        </div>
    </div>

    @if(session('success'))
        <div class="alert alert-success">{{ session('success') }}</div>
    @endif

    <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-light fw-semibold">Pending</div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover mb-0 align-middle">
                    <thead class="table-light">
                        <tr>
                            <th>ID</th>
                            <th>Operator</th>
                            <th>Terminal</th>
                            <th>Routes</th>
                            <th>Submitted</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="sysadmin-pending-tbody">
                        @include('approvals.partials.pending-tbody', ['pending' => $pending])
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="modal fade" id="declineModalUnified" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <form method="POST" id="sysadminDeclineForm">
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

    <div class="card border-0 shadow-sm">
        <div class="card-header bg-light fw-semibold">Recent decisions</div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-sm mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>ID</th>
                            <th>Operator</th>
                            <th>Status</th>
                            <th>Decided</th>
                        </tr>
                    </thead>
                    <tbody id="sysadmin-history-tbody">
                        @include('approvals.partials.history-tbody', ['history' => $history])
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
(function () {
    const declineModal = document.getElementById('declineModalUnified');
    if (declineModal) {
        declineModal.addEventListener('show.bs.modal', function (event) {
            const btn = event.relatedTarget;
            const form = document.getElementById('sysadminDeclineForm');
            const title = declineModal.querySelector('.modal-title');
            if (btn && form && btn.getAttribute('data-decline-url')) {
                form.action = btn.getAttribute('data-decline-url');
                const id = btn.getAttribute('data-decline-id');
                if (title && id) {
                    title.textContent = 'Decline request #' + id;
                }
            }
        });
    }

    let lastSignature = @json($pollSignature);
    const pollUrl = @json(route('sysadmin.approvals.poll'));

    async function pollApprovals() {
        try {
            const res = await fetch(pollUrl, {
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.signature === lastSignature) return;
            lastSignature = data.signature;
            const pendingTbody = document.getElementById('sysadmin-pending-tbody');
            const historyTbody = document.getElementById('sysadmin-history-tbody');
            if (pendingTbody && data.pending_rows) pendingTbody.innerHTML = data.pending_rows;
            if (historyTbody && data.history_rows) historyTbody.innerHTML = data.history_rows;
        } catch (e) { /* network / tab background */ }
    }

    setInterval(pollApprovals, 4000);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') pollApprovals();
    });
    pollApprovals();
})();
</script>
@endpush
