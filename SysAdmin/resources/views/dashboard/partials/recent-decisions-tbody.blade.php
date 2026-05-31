@forelse($recentDecisions as $item)
    @php $r = $item['request']; @endphp
    <tr data-status="{{ $r->status }}">
        <td>#{{ $r->id }}</td>
        <td>{{ $r->operator?->name ?? ('User #'.$r->operator_user_id) }}</td>
        <td><span class="badge bg-secondary text-uppercase">{{ $r->terminal ?: '' }}</span></td>
        <td class="small">{{ $item['route_names'] }}</td>
        <td>
            @if($r->status === 'approved')
                <span class="badge bg-success"><i class="fas fa-check me-1"></i>Approved</span>
            @else
                <span class="badge bg-danger"><i class="fas fa-times me-1"></i>Declined</span>
            @endif
        </td>
        <td class="small text-muted">{{ $r->decided_at?->diffForHumans() ?? '' }}</td>
    </tr>
@empty
    <tr>
        <td colspan="6" class="text-center text-muted py-4">No route decisions recorded yet.</td>
    </tr>
@endforelse
