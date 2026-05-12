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
                    <div class="fs-3 fw-bold text-primary" id="st-count-total">{{ $counts['total'] }}</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-3 mb-3">
            <div class="card border-0 shadow-sm border-start border-danger border-4 h-100">
                <div class="card-body py-3">
                    <div class="text-muted small">Open</div>
                    <div class="fs-3 fw-bold text-danger" id="st-count-open">{{ $counts['open'] }}</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-3 mb-3">
            <div class="card border-0 shadow-sm border-start border-warning border-4 h-100">
                <div class="card-body py-3">
                    <div class="text-muted small">In Progress</div>
                    <div class="fs-3 fw-bold text-warning" id="st-count-in-progress">{{ $counts['in_progress'] }}</div>
                </div>
            </div>
        </div>
        <div class="col-6 col-md-3 mb-3">
            <div class="card border-0 shadow-sm border-start border-success border-4 h-100">
                <div class="card-body py-3">
                    <div class="text-muted small">Resolved</div>
                    <div class="fs-3 fw-bold text-success" id="st-count-resolved">{{ $counts['resolved'] }}</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Ticket table -->
    <div class="card border-0 shadow-sm">
        <div class="card-header bg-light d-flex justify-content-between align-items-center">
            <h5 class="mb-0"><i class="fas fa-list me-2 text-primary"></i> All Tickets</h5>
            <div class="d-flex align-items-center gap-2">
                <span class="badge bg-light text-muted border" id="st-poll-status" title="Checks for new tickets in the background">Auto-refresh on</span>
                <input type="text" id="ticketSearch" class="form-control form-control-sm w-auto" placeholder="Search subject…">
            </div>
        </div>
        <div class="card-body p-0" id="support-tickets-card-body">
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
                                <th class="text-center">Subject</th>
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
                                <td class="text-center">
                                    <span class="fw-semibold d-inline-block">{{ $ticket->subject }}</span>
                                    <div class="text-muted small text-truncate mx-auto" style="max-width:220px">{{ $ticket->description }}</div>
                                </td>
                                <td><span class="badge bg-secondary">{{ ucfirst($ticket->category) }}</span></td>
                                <td class="small">
                                    @if($ticket->commuter)
                                        {{ $ticket->commuter->displayName() }}<br>
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
                                    <button type="button" class="btn btn-sm btn-outline-primary"
                                        data-bs-toggle="modal"
                                        data-bs-target="#ticketModal"
                                        data-ticket-idx="{{ $loop->index }}">
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
(function () {
    const pollUrl = @json(route('support-tickets.panel.poll'));
    const POLL_MS = 12000;
    let ticketCache = @json($ticketsPoll);
    let modalOpen = false;

    function escapeHtml(str) {
        if (str == null || str === '') return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function priorityBadgeClass(p) {
        switch (p) {
            case 'urgent': return 'danger';
            case 'high': return 'warning';
            case 'medium': return 'info';
            default: return 'secondary';
        }
    }

    function statusBadgeClass(s) {
        switch (s) {
            case 'open': return 'danger';
            case 'in-progress': return 'warning';
            case 'resolved': return 'success';
            default: return 'secondary';
        }
    }

    function ucFirst(s) {
        if (!s) return '';
        const t = String(s);
        return t.charAt(0).toUpperCase() + t.slice(1);
    }

    function applySearchFilter() {
        const input = document.getElementById('ticketSearch');
        if (!input) return;
        const q = input.value.toLowerCase();
        document.querySelectorAll('#ticketsTable tbody tr').forEach(function (row) {
            row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    }

    function setCounts(counts) {
        const map = [
            ['st-count-total', counts.total],
            ['st-count-open', counts.open],
            ['st-count-in-progress', counts.in_progress],
            ['st-count-resolved', counts.resolved],
        ];
        map.forEach(function (pair) {
            const el = document.getElementById(pair[0]);
            if (el) el.textContent = pair[1];
        });
    }

    function renderTicketRows(tickets) {
        const body = document.getElementById('support-tickets-card-body');
        if (!body) return;

        if (!tickets.length) {
            body.innerHTML =
                '<div class="text-center py-5 text-muted">' +
                '<i class="fas fa-inbox fa-3x mb-3"></i>' +
                '<p>No support tickets yet.</p></div>';
            return;
        }

        const rows = tickets.map(function (t, idx) {
            const pClass = priorityBadgeClass(t.priority);
            const sClass = statusBadgeClass(t.status);
            let commuterCell = '<td class="small"><span class="text-muted">Guest</span></td>';
            if (t.commuter) {
                commuterCell = '<td class="small">' + escapeHtml(t.commuter.display_name) + '<br>' +
                    '<span class="text-muted">' + escapeHtml(t.commuter.email) + '</span></td>';
            }
            return (
                '<tr>' +
                '<td class="text-muted small">' + escapeHtml(String(t.id)) + '</td>' +
                '<td class="text-center">' +
                '<span class="fw-semibold d-inline-block">' + escapeHtml(t.subject) + '</span>' +
                '<div class="text-muted small text-truncate mx-auto" style="max-width:220px">' + escapeHtml(t.description) + '</div></td>' +
                '<td><span class="badge bg-secondary">' + escapeHtml(ucFirst(t.category)) + '</span></td>' +
                commuterCell +
                '<td><span class="badge bg-' + pClass + '">' + escapeHtml(ucFirst(t.priority)) + '</span></td>' +
                '<td><span class="badge bg-' + sClass + '">' + escapeHtml(ucFirst(t.status)) + '</span></td>' +
                '<td class="small text-muted">' + escapeHtml(t.created_human) + '</td>' +
                '<td><button type="button" class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#ticketModal" data-ticket-idx="' + idx + '">' +
                '<i class="fas fa-reply me-1"></i> Respond</button></td>' +
                '</tr>'
            );
        }).join('');

        body.innerHTML =
            '<div class="table-responsive">' +
            '<table class="table table-hover mb-0" id="ticketsTable">' +
            '<thead class="table-light"><tr><th>#</th><th class="text-center">Subject</th><th>Category</th><th>Commuter</th><th>Priority</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>';
        applySearchFilter();
    }

    async function pollSupportTickets() {
        if (document.hidden || modalOpen) return;
        const badge = document.getElementById('st-poll-status');
        try {
            const res = await fetch(pollUrl, {
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            if (!res.ok) return;
            const data = await res.json();
            if (!data.success || !Array.isArray(data.tickets)) return;
            ticketCache = data.tickets;
            if (data.counts) {
                setCounts(data.counts);
            }
            renderTicketRows(ticketCache);
            if (badge) {
                badge.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                badge.classList.remove('text-danger');
            }
        } catch (e) {
            if (badge) {
                badge.textContent = 'Refresh paused';
                badge.classList.add('text-danger');
            }
        }
    }

    const ticketModal = document.getElementById('ticketModal');
    if (ticketModal) {
        ticketModal.addEventListener('show.bs.modal', function (e) {
            modalOpen = true;
            const btn = e.relatedTarget;
            if (!btn || btn.dataset.ticketIdx === undefined) return;
            const idx = parseInt(btn.dataset.ticketIdx, 10);
            const t = ticketCache[idx];
            if (!t) return;
            document.getElementById('modalSubject').textContent = t.subject;
            document.getElementById('modalDescription').textContent = t.description || '';
            document.getElementById('modalStatus').value = t.status;
            document.getElementById('modalPriority').value = t.priority;
            document.getElementById('modalResponse').value = t.operator_response || '';
            document.getElementById('respondForm').action = '/panel/support-tickets/' + encodeURIComponent(t.public_ticket_id);
        });
        ticketModal.addEventListener('hidden.bs.modal', function () {
            modalOpen = false;
            pollSupportTickets();
        });
    }

    document.getElementById('ticketSearch').addEventListener('input', applySearchFilter);

    setInterval(pollSupportTickets, POLL_MS);
    setTimeout(pollSupportTickets, 2500);
})();
</script>
@endsection
