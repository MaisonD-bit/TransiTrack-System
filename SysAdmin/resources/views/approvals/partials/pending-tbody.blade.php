@forelse($pending as $item)
    @php $r = $item['request']; @endphp
    <tr>
        <td>#{{ $r->id }}</td>
        <td>{{ $r->operator?->name ?? 'User #'.$r->operator_user_id }}</td>
        <td><span class="badge bg-secondary text-uppercase">{{ $r->terminal }}</span></td>
        <td class="small">{{ $item['route_names'] ?: '—' }}</td>
        <td class="small text-muted">{{ $r->submitted_by_terminal_at?->diffForHumans() ?? $r->created_at->diffForHumans() }}</td>
        <td class="text-end text-nowrap">
            <a href="{{ route('sysadmin.approvals.review', $r) }}" class="btn btn-sm btn-outline-primary">
                <i class="fas fa-map"></i> Review
            </a>
            <form action="{{ route('sysadmin.approvals.approve', $r) }}" method="POST" class="d-inline js-sysadmin-approve-form" data-confirm-message="Approve this route package?">
                @csrf
                <button type="submit" class="btn btn-sm btn-success"><i class="fas fa-check"></i> Approve</button>
            </form>
            <button type="button" class="btn btn-sm btn-outline-danger"
                    data-bs-toggle="modal"
                    data-bs-target="#declineModalUnified"
                    data-decline-url="{{ route('sysadmin.approvals.decline', $r) }}"
                    data-decline-id="{{ $r->id }}">Decline</button>
        </td>
    </tr>
@empty
    <tr>
        <td colspan="6" class="text-center text-muted py-4">No pending approvals.</td>
    </tr>
@endforelse
