@extends('layouts.app-sidebar')

@section('title', 'Route stops & sysadmin')

@section('content')
<div class="container-fluid px-0">
    <div class="d-flex align-items-center mb-4">
        <i class="fas fa-map-marked-alt me-3 text-primary fs-4"></i>
        <div>
            <h2 class="mb-0 fw-bold">Terminal route stops</h2>
            <p class="text-muted small mb-0">
                Open a <strong>bus operator</strong> below, then choose a <strong>route</strong> to add stops on the map. Save each route, then send the submission to sysadmin when ready
                ({{ strtoupper($terminal) }} terminal).
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

    <div id="route-stops-live"
         data-initial-checksum="{{ $listChecksum }}"
         data-poll-url="{{ route('route-stops.poll') }}">
        @include('route-stops')
    </div>
</div>
@endsection

@push('scripts')
<script>
(function () {
    const root = document.getElementById('route-stops-live');
    if (!root) return;

    root.addEventListener('submit', async (e) => {
        const form = e.target.closest('.js-tm-submit-sysadmin');
        if (!form) return;
        e.preventDefault();
        const message = form.dataset.confirm || 'Send this submission to sysadmin for approval?';
        const confirmed = typeof showSpaceConfirm === 'function'
            ? await showSpaceConfirm(message, 'Send', 'Cancel')
            : confirm(message);
        if (confirmed) form.submit();
    });

    if (!root.dataset.pollUrl) return;
    let lastChecksum = root.dataset.initialChecksum || '';
    const pollUrl = root.dataset.pollUrl;
    const intervalMs = 6000;

    async function pollRouteStops() {
        try {
            const res = await fetch(pollUrl, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            if (!res.ok) return;
            const data = await res.json();
            if (typeof data.checksum !== 'string' || typeof data.html !== 'string') return;
            if (data.checksum !== lastChecksum) {
                lastChecksum = data.checksum;
                root.innerHTML = data.html;
            }
        } catch (_) { /* offline / transient */ }
    }

    setInterval(pollRouteStops, intervalMs);
    setTimeout(pollRouteStops, 2000);
})();
</script>
@endpush
