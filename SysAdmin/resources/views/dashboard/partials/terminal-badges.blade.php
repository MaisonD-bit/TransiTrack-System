@if($pendingByTerminal->isEmpty())
    <p class="small text-muted mb-0">No pending route approvals in your queue.</p>
@else
    <div class="d-flex flex-wrap gap-2">
        @foreach($pendingByTerminal as $terminal => $count)
            <span class="badge bg-warning text-dark text-uppercase">
                {{ $terminal ?: 'unknown' }}: {{ $count }}
            </span>
        @endforeach
    </div>
@endif
