@extends('layouts.app')

@section('title', 'Support Tickets')

@section('content')
<div class="container-fluid">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div class="d-flex align-items-center">
            <i class="fas fa-headset me-3 text-primary fs-4"></i>
            <div>
                <h2 class="mb-0 fw-bold">Support Tickets</h2>
                <p class="text-muted small mb-0">Commuter complaints and inquiries</p>
            </div>
        </div>
    </div>

    @if(session('success'))
        <div class="alert alert-success alert-dismissible fade show" role="alert">
            {{ session('success') }}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    @endif

    <!-- Summary cards -->
    <div class="row mb-4">
        <div class="col-6 col-md-3 mb-3">
            <div class="card border-0 shadow-sm border-start border-primary border-4 h-100">
                <div class="card-body py-3">
                    <div class="text-muted small">Total</div>
                    <div class="fs-3 fw-bold text-primary">{{ $counts['total'] }}</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-3 mb-3">
            <div class="card border-0 shadow-sm border-start border-danger border-4 h-100">
                <div class="card-body py-3">
                    <div class="text-muted small">Open</div>
                    <div class="fs-3 fw-bold text-danger">{{ $counts['open'] }}</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-3 mb-3">
            <div class="card border-0 shadow-sm border-start border-warning border-4 h-100">
                <div class="card-body py-3">
                    <div class="text-muted small">In Progress</div>
                    <div class="fs-3 fw-bold text-warning">{{ $counts['in_progress'] }}</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-3 mb-3">
            <div class="card border-0 shadow-sm border-start border-success border-4 h-100">
                <div class="card-body py-3">
                    <div class="text-muted small">Resolved</div>
                    <div class="fs-3 fw-bold text-success">{{ $counts['resolved'] }}</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Ticket table -->
    <div class="card border-0 shadow-sm">
        <div class="card-header bg-light d-flex justify-content-between align-items-center">
            <h5 class="mb-0"><i class="fas fa-list me-2 text-primary"></i> All Tickets</h5>
            <input type="text" id="ticketSearch" class="form-control form-control-sm w-auto" placeholder="Search subject…">
        </div>
        <div class="card-body p-0">
            @if($tickets->isEmpty())
                <div class="text-center py-5 text-muted">
                    <i class="fas fa-inbox fa-3x mb-3"></i>
                    <p>No support tickets yet.</p>
                </div>
            @else
                <div class="table-responsive">
                    <table class="table table-hover mb-0" id="ticketsTable">
                        <thead class="table-light">
                            <tr>
                                <th>#</th>
                                <th>Subject</th>
                                <th>Category</th>
                                <th>Commuter</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Submitted</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($tickets as $ticket)
                            <tr>
                                <td class="text-muted small">{{ $ticket->id }}</td>
                                <td>
                                    <span class="fw-semibold">{{ $ticket->subject }}</span>
                                    <div class="text-muted small text-truncate" style="max-width:200px">{{ $ticket->description }}</div>
                                </td>
                                <td><span class="badge bg-secondary">{{ ucfirst($ticket->category) }}</span></td>
                                <td class="small">
                                    @if($ticket->commuter)
                                        {{ $ticket->commuter->first_name }} {{ $ticket->commuter->last_name }}<br>
                                        <span class="text-muted">{{ $ticket->commuter->email }}</span>
                                    @else
                                        <span class="text-muted">Guest</span>
                                    @endif
                                </td>
                                <td>
                                    @php
                                        $pColor = match($ticket->priority) {
                                            'urgent' => 'danger', 'high' => 'warning',
                                            'medium' => 'info',   default => 'secondary'
                                        };
                                    @endphp
                                    <span class="badge bg-{{ $pColor }}">{{ ucfirst($ticket->priority) }}</span>
                                </td>
                                <td>
                                    @php
                                        $sColor = match($ticket->status) {
                                            'open'        => 'danger',
                                            'in-progress' => 'warning',
                                            'resolved'    => 'success',
                                            default       => 'secondary'
                                        };
                                    @endphp
                                    <span class="badge bg-{{ $sColor }}">{{ ucfirst($ticket->status) }}</span>
                                </td>
                                <td class="small text-muted">{{ $ticket->created_at->diffForHumans() }}</td>
                                <td>
                                    <button class="btn btn-sm btn-outline-primary"
                                        data-bs-toggle="modal"
                                        data-bs-target="#ticketModal"
                                        data-id="{{ $ticket->public_ticket_id }}"
                                        data-subject="{{ $ticket->subject }}"
                                        data-description="{{ $ticket->description }}"
                                        data-category="{{ $ticket->category }}"
                                        data-status="{{ $ticket->status }}"
                                        data-priority="{{ $ticket->priority }}"
                                        data-response="{{ $ticket->operator_response }}">
                                        <i class="fas fa-reply me-1"></i> Respond
                                    </button>
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

<!-- Respond Modal -->
<div class="modal fade" id="ticketModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title"><i class="fas fa-ticket-alt me-2"></i> <span id="modalSubject"></span></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form method="POST" id="respondForm" action="">
                @csrf
                @method('PATCH')
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label text-muted small">Commuter's Message</label>
                        <div class="p-3 bg-light rounded" id="modalDescription"></div>
                    </div>
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <label class="form-label fw-semibold">Status</label>
                            <select name="status" class="form-select" id="modalStatus">
                                <option value="open">Open</option>
                                <option value="in-progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label fw-semibold">Priority</label>
                            <select name="priority" class="form-select" id="modalPriority">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-semibold">Your Response <span class="text-muted small">(optional)</span></label>
                        <textarea name="response" class="form-control" rows="4" id="modalResponse"
                            placeholder="Type your response to the commuter…"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save me-1"></i> Save</button>
                </div>
            </form>
        </div>
    </div>
</div>

<script>
// Populate modal from row data
document.getElementById('ticketModal').addEventListener('show.bs.modal', function (e) {
    const btn = e.relatedTarget;
    document.getElementById('modalSubject').textContent     = btn.dataset.subject;
    document.getElementById('modalDescription').textContent = btn.dataset.description;
    document.getElementById('modalStatus').value            = btn.dataset.status;
    document.getElementById('modalPriority').value          = btn.dataset.priority;
    document.getElementById('modalResponse').value          = btn.dataset.response || '';
    document.getElementById('respondForm').action = `/panel/support-tickets/${btn.dataset.id}`;
});

// Live search
document.getElementById('ticketSearch').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll('#ticketsTable tbody tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
});
</script>
@endsection
