@forelse($pendingQueue as $item)
    @php $r = $item['request']; @endphp
    <tr>
        <td><span class="fw-bold">#{{ $r->id }}</span></td>
        <td>
            <div class="d-flex align-items-center">
                <div class="bg-primary bg-opacity-10 rounded-circle me-2 d-flex align-items-center justify-content-center" style="width: 30px; height: 30px;">
                    <i class="fas fa-user text-primary"></i>
                </div>
                {{ $r->operator?->name ?? ('User #'.$r->operator_user_id) }}
            </div>
        </td>
        <td><span class="badge bg-secondary text-uppercase">{{ $r->terminal ?: '' }}</span></td>
        <td>
            <div class="d-flex align-items-center">
                <div class="bg-warning bg-opacity-10 rounded-circle me-2 d-flex align-items-center justify-content-center" style="width: 30px; height: 30px;">
                    <i class="fas fa-route text-warning"></i>
                </div>
                <span class="small">{{ $item['route_names'] }}</span>
            </div>
        </td>
        <td>
            @php $submittedAt = $r->submitted_for_sysadmin_at ?? $r->submitted_by_terminal_at; @endphp
            <span class="fw-semibold">{{ $submittedAt?->format('M d, Y') ?? '' }}</span>
            @if($submittedAt)
                <br><small class="text-muted">{{ $submittedAt->format('g:i A') }}</small>
            @endif
        </td>
        <td>
            <a href="{{ route('sysadmin.approvals.review', $r) }}" class="btn btn-sm btn-primary" title="Review">
                <i class="fas fa-eye"></i>
            </a>
        </td>
    </tr>
@empty
    <tr>
        <td colspan="6" class="text-center text-muted py-4">No pending route approvals</td>
    </tr>
@endforelse

