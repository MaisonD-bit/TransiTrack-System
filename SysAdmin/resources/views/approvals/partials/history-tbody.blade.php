@forelse($history as $h)
    <tr>
        <td>#{{ $h->id }}</td>
        <td>{{ $h->operator?->name ?? '—' }}</td>
        <td>
            @if($h->status === 'approved')
                <span class="badge bg-success">approved</span>
            @else
                <span class="badge bg-danger">declined</span>
            @endif
        </td>
        <td class="small text-muted">{{ $h->decided_at?->diffForHumans() }}</td>
    </tr>
@empty
    <tr>
        <td colspan="4" class="text-center text-muted py-4">No recent decisions yet.</td>
    </tr>
@endforelse
