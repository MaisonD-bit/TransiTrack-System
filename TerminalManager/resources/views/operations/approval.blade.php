<div>
    @extends('layouts.app-sidebar')

    @section('title', 'Bus Operator Approval')

    @section('content')
    <style>
        .approval-container {
            min-height: 100vh;
            padding: 2rem 0;
        }

        .operator-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            transition: all 0.3s ease;
            margin-bottom: 1rem;
            width: 320px;
        }

        #operators-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 1.5rem;
        }

        .operator-card:hover {
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
            transform: translateY(-2px);
        }

        .operator-card-header {
            background: linear-gradient(135deg, #2b7be4 0%, #1e5ba8 100%);
            padding: 1rem;
            color: white;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .operator-avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            border: 3px solid rgba(255, 255, 255, 0.3);
            flex-shrink: 0;
        }

        .operator-header-info h5 {
            margin: 0;
            font-weight: 600;
            font-size: 1.1rem;
        }

        .operator-header-info p {
            margin: 0.15rem 0 0 0;
            font-size: 0.8rem;
            opacity: 0.9;
        }

        .operator-card-body {
            padding: 1rem;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1rem;
            margin-bottom: 1rem;
        }

        .info-item {
            padding-left: 0.75rem;
        }

        .info-label {
            font-size: 0.7rem;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 0.15rem;
        }

        .info-value {
            font-size: 0.85rem;
            color: #333;
            font-weight: 500;
        }

        .status-badge {
            display: inline-block;
            padding: 0.35rem 0.8rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            white-space: nowrap;
        }

        .status-pending {
            background: #fff3cd;
            color: #856404;
        }

        .status-approved {
            background: #d4edda;
            color: #155724;
        }

        .action-buttons {
            display: flex;
            gap: 0.75rem;
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid #eee;
        }

        .btn-approve,
        .btn-reject,
        .btn-deactivate {
            flex: 1;
            padding: 0.6rem 1.2rem;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.85rem;
        }

        .btn-approve {
            background: linear-gradient(135deg, #1bb76e 0%, #15a05e 100%);
            color: white;
        }

        .btn-approve:hover {
            background: linear-gradient(135deg, #15a05e 0%, #0f8c4d 100%);
            transform: translateY(-2px);
        }

        .btn-reject,
        .btn-deactivate {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white;
        }

        .btn-reject:hover,
        .btn-deactivate:hover {
            background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
            transform: translateY(-2px);
        }

        .approval-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
        }

        .approval-title {
            font-size: 2rem;
            font-weight: bold;
            color: #333;
        }

        .filter-tabs {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 2rem;
        }

        .filter-tab {
            padding: 0.75rem 1.5rem;
            border: 2px solid #ddd;
            background: white;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            color: #666;
            transition: all 0.3s ease;
        }

        .filter-tab[data-filter="inactive"] {
            border-color: #f39c12;
            color: #f39c12;
        }

        .filter-tab[data-filter="inactive"]:hover {
            background: #f39c12;
            color: white;
        }

        .filter-tab[data-filter="inactive"].active {
            background: #f39c12;
            color: white;
            border-color: #f39c12;
        }

        .filter-tab[data-filter="active"] {
            border-color: #1bb76e;
            color: #1bb76e;
        }

        .filter-tab[data-filter="active"]:hover {
            background: #1bb76e;
            color: white;
        }

        .filter-tab[data-filter="active"].active {
            background: #1bb76e;
            color: white;
            border-color: #1bb76e;
        }

        .filter-tab[data-filter="all"] {
            border-color: #2b7be4;
            color: #2b7be4;
        }

        .filter-tab[data-filter="all"]:hover {
            background: #2b7be4;
            color: white;
        }

        .filter-tab[data-filter="all"].active {
            background: #2b7be4;
            color: white;
            border-color: #2b7be4;
        }

        .filter-tab.active {
            color: white;
        }

        .filter-tab:hover {
            color: white;
        }

        .empty-state {
            text-align: center;
            padding: 3rem;
            background: white;
            border-radius: 12px;
        }

        .empty-state-icon {
            font-size: 3rem;
            color: #ddd;
            margin-bottom: 1rem;
        }

        .empty-state-title {
            font-size: 1.3rem;
            color: #666;
            margin-bottom: 0.5rem;
        }

        .empty-state-text {
            color: #999;
        }

        .notes-section {
            background: #f8f9fa;
            padding: 0.75rem;
            border-radius: 8px;
            margin-bottom: 0.75rem;
        }

        .notes-label {
            font-size: 0.75rem;
            color: #666;
            margin-bottom: 0.3rem;
            font-weight: 600;
        }

        .notes-text {
            color: #555;
            font-size: 0.8rem;
            line-height: 1.4;
        }

        .rejection-notes {
            background: #f8d7da;
            border-left: 4px solid #dc3545;
        }

        .approval-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }

        .approval-modal.show {
            display: flex;
        }

        .modal-content {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
            font-size: 1.3rem;
            font-weight: bold;
            margin-bottom: 1rem;
            color: #333;
        }

        .modal-textarea {
            width: 100%;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 0.75rem;
            font-family: inherit;
            font-size: 0.95rem;
            resize: vertical;
            min-height: 100px;
            margin-bottom: 1rem;
        }

        .modal-actions {
            display: flex;
            gap: 1rem;
        }

        .modal-actions button {
            flex: 1;
            padding: 0.75rem;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .modal-cancel {
            background: #e9ecef;
            color: #333;
        }

        .modal-cancel:hover {
            background: #dee2e6;
        }

        .modal-confirm {
            background: #dc3545;
            color: white;
        }

        .modal-confirm:hover {
            background: #c82333;
        }

        .license-section {
            background: #e7f3ff;
            border-left: 4px solid #2b7be4;
            padding: 0.75rem;
            border-radius: 6px;
            margin-bottom: 0.75rem;
        }
    </style>

    <div class="approval-container">
        <div class="container py-4">
            <!-- Header -->
            <div class="approval-header">
                <div>
                    <h1 class="approval-title">
                        <i class="fas fa-check-circle me-3 text-primary"></i>Bus Operator Approval
                    </h1>
                    <p class="text-muted">Manage bus operator registrations and access requests</p>
                </div>
                <div class="text-end">
                    <div style="font-size: 2rem; font-weight: bold; color: #2b7be4;">
                        <span id="pending-count">0</span>
                    </div>
                    <div style="font-size: 0.9rem; color: #999;">Pending Approvals</div>
                </div>
            </div>

            <!-- Filter Tabs -->
            <div class="filter-tabs">
                <button class="filter-tab active" data-filter="inactive">
                    <i class="fas fa-hourglass-half me-2"></i>Pending / Inactive
                </button>
                <button class="filter-tab" data-filter="active">
                    <i class="fas fa-check me-2"></i>Approved / Active
                </button>
                <button class="filter-tab" data-filter="all">
                    <i class="fas fa-list me-2"></i>All
                </button>
            </div>

            <!-- Operators List -->
            <div id="operators-list">
                <!-- Operator cards will be loaded here -->
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <div class="empty-state-title">No operators found</div>
                    <div class="empty-state-text">There are no bus operators to review at this time.</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal for Rejection Notes -->
    <div class="approval-modal" id="rejectionModal">
        <div class="modal-content">
            <div class="modal-header">Reject Operator</div>
            <p style="color: #666; margin-bottom: 1rem;">Please provide a reason for rejection:</p>
            <textarea class="modal-textarea" id="rejectionNotes" placeholder="Enter rejection reason..."></textarea>
            <div class="modal-actions">
                <button class="modal-cancel" onclick="closeRejectionModal()">Cancel</button>
                <button class="modal-confirm" onclick="confirmRejection()">Reject</button>
            </div>
        </div>
    </div>

    <script>
        let currentOperatorId = null;
        let currentFilter = 'inactive';
        let operators = @json($operators);

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            renderOperators();
            setupFilterTabs();
            updatePendingCount();
        });

        function setupFilterTabs() {
            document.querySelectorAll('.filter-tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    currentFilter = this.dataset.filter;
                    renderOperators();
                });
            });
        }

        function renderOperators() {
            const listContainer = document.getElementById('operators-list');
            let filtered = operators;

            if (currentFilter !== 'all') {
                filtered = operators.filter(op => op.status === currentFilter);
            }

            updatePendingCount();

            if (filtered.length === 0) {
                listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <div class="empty-state-title">No operators found</div>
                    <div class="empty-state-text">There are no bus operators matching this filter.</div>
                </div>
            `;
                return;
            }

            listContainer.innerHTML = filtered.map(operator => {
                const fullName = `${operator.first_name} ${operator.last_name}`;
                const statusClass = operator.status === 'inactive' ? 'status-pending' : 'status-approved';
                const statusDisplay = operator.status === 'inactive' ? 'Pending' : 'Approved';

                return `
                <div class="operator-card">
                    <div class="operator-card-header">
                        <div class="operator-avatar">
                            ${operator.photo_url ? `<img src="${operator.photo_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : `<i class="fas fa-building"></i>`}
                        </div>
                        <div class="operator-header-info flex-grow-1">
                            <h5>${fullName}</h5>
                            <p>${operator.company_name || 'N/A'}</p>
                        </div>
                        <span class="status-badge ${statusClass}">
                            ${statusDisplay}
                        </span>
                    </div>

                    <div class="operator-card-body">
                        <!-- Company Section -->
                        <div class="license-section">
                            <div class="info-item">
                                <div class="info-label">Company Information</div>
                                <div class="info-value">
                                    ${operator.company_name || 'N/A'}
                                    ${operator.fleet_size ? `<span style="margin-left: 1rem; font-size: 0.85rem; color: #2b7be4;">Fleet Size: ${operator.fleet_size}</span>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- Info Grid -->
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">Email</div>
                                <div class="info-value">${operator.email}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Contact Number</div>
                                <div class="info-value">${operator.contact_number || 'N/A'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Gender</div>
                                <div class="info-value">${operator.gender || 'N/A'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Company Address</div>
                                <div class="info-value">${operator.company_address || 'N/A'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Company Email</div>
                                <div class="info-value">${operator.company_email || 'N/A'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Routes Served</div>
                                <div class="info-value">${operator.routes_served || 'N/A'}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Registration Date</div>
                                <div class="info-value">${formatDate(operator.created_at)}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Terminal</div>
                                <div class="info-value" style="text-transform: capitalize;">${operator.terminal || 'N/A'}</div>
                            </div>
                        </div>

                        ${operator.status === 'inactive' ? `
                            <div class="action-buttons">
                                <button class="btn-approve" onclick="approveOperator(${operator.id})">
                                    <i class="fas fa-check me-2"></i>Approve
                                </button>
                                <button class="btn-reject" onclick="openRejectionModal(${operator.id})">
                                    <i class="fas fa-times me-2"></i>Reject
                                </button>
                            </div>
                        ` : operator.status === 'active' ? `
                            <div class="action-buttons">
                                <button class="btn-deactivate" onclick="deactivateOperator(${operator.id})">
                                    <i class="fas fa-ban me-2"></i>Deactivate
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            }).join('');
        }

        function approveOperator(id) {
            const operator = operators.find(op => op.id === id);
            if (!operator) return;

            if (confirm(`Approve ${operator.first_name} ${operator.last_name}?`)) {
                fetch(`/api/approvals/approve/${id}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            // Update local operator status
                            operator.status = 'active';
                            renderOperators();
                            showNotification('Operator approved successfully', 'success');
                        } else {
                            showNotification('Error approving operator', 'error');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        showNotification('Error approving operator', 'error');
                    });
            }
        }

        function deactivateOperator(id) {
            const operator = operators.find(op => op.id === id);
            if (!operator) return;

            if (confirm(`Deactivate ${operator.first_name} ${operator.last_name}? They will lose access to the system.`)) {
                fetch(`/api/approvals/pending/${id}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                        },
                        body: JSON.stringify({
                            reason: 'Deactivated by manager'
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            // Update local operator status
                            operator.status = 'inactive';
                            renderOperators();
                            showNotification('Operator deactivated successfully', 'success');
                        } else {
                            showNotification('Error deactivating operator', 'error');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        showNotification('Error deactivating operator', 'error');
                    });
            }
        }

        function openRejectionModal(id) {
            currentOperatorId = id;
            document.getElementById('rejectionModal').classList.add('show');
        }

        function closeRejectionModal() {
            document.getElementById('rejectionModal').classList.remove('show');
            document.getElementById('rejectionNotes').value = '';
        }

        function confirmRejection() {
            const notes = document.getElementById('rejectionNotes').value.trim();
            if (!notes) {
                alert('Please enter a rejection reason');
                return;
            }

            fetch(`/api/approvals/pending/${currentOperatorId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                    },
                    body: JSON.stringify({
                        reason: notes
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const operator = operators.find(op => op.id === currentOperatorId);
                        if (operator) {
                            operator.status = 'inactive';
                        }
                        renderOperators();
                        closeRejectionModal();
                        showNotification('Operator deactivated successfully', 'success');
                    } else {
                        showNotification('Error deactivating operator', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showNotification('Error rejecting operator', 'error');
                });
        }

        function formatDate(dateString) {
            const options = {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            };
            return new Date(dateString).toLocaleDateString('en-US', options);
        }

        function updatePendingCount() {
            const pendingCount = operators.filter(op => op.status === 'inactive').length;
            document.getElementById('pending-count').textContent = pendingCount;
        }

        function showNotification(message, type) {
            // Simple notification - can be enhanced with a toast library
            alert(message);
        }

        // Close modal when clicking outside
        document.getElementById('rejectionModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeRejectionModal();
            }
        });
    </script>
    @endsection
</div>