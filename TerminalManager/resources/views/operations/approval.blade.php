@extends('layouts.app-sidebar')

@section('title', 'Bus Operator Approval')

@section('content')
<style>
    .approval-page {
        background: white;
    }

    .page-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid #e9ecef;
    }

    .page-title {
        font-size: 2rem;
        font-weight: 600;
        color: #333;
        margin: 0;
    }

    .page-subtitle {
        color: #666;
        font-size: 0.8rem;
        margin-top: 0.35rem;
    }

    .filter-section {
        padding: 1rem 1.5rem;
        display: flex;
        gap: 0.75rem;
        border-bottom: 1px solid #e9ecef;
    }

    .filter-btn {
        padding: 0.45rem 0.9rem;
        border: none;
        background: white;
        border-radius: 5px;
        cursor: pointer;
        font-weight: 500;
        font-size: 0.85rem;
        color: #666;
        transition: all 0.3s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .filter-btn.active {
        background: #2b7be4;
        color: white;
        box-shadow: 0 2px 8px rgba(43, 123, 228, 0.3);
    }

    .filter-btn:hover:not(.active) {
        background: #f0f0f0;
    }

    .table-section {
        padding: 1.25rem 1.5rem;
    }

    .operators-table {
        width: 100%;
        border-collapse: collapse;
        background: white;
    }

    .operators-table thead {
        background: #f8f9fa;
        border-bottom: 2px solid #dee2e6;
    }

    .operators-table th {
        padding: 0.7rem 0.8rem;
        text-align: left;
        font-weight: 600;
        color: #333;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }

    .operators-table td {
        padding: 0.7rem 0.8rem;
        border-bottom: 1px solid #e9ecef;
        color: #333;
        font-size: 0.9rem;
    }

    .operators-table tbody tr:hover {
        background: #f8f9fa;
    }

    .operator-name {
        font-weight: 600;
        color: #333;
        font-size: 0.9rem;
    }

    .operator-company {
        color: #666;
        font-size: 0.8rem;
    }

    .status-badge {
        display: inline-block;
        padding: 0.25rem 0.6rem;
        border-radius: 20px;
        font-size: 0.7rem;
        font-weight: 600;
    }

    .status-pending {
        background: #fff3cd;
        color: #856404;
    }

    .status-approved {
        background: #d4edda;
        color: #155724;
    }

    .action-btns {
        display: flex;
        gap: 0.4rem;
    }

    .btn-sm {
        padding: 0.35rem 0.7rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.75rem;
        font-weight: 600;
        transition: all 0.3s ease;
    }

    .btn-approve {
        background: #1bb76e;
        color: white;
    }

    .btn-approve:hover {
        background: #15a05e;
    }

    .btn-view {
        background: #17a2b8;
        color: white;
    }

    .btn-view:hover {
        background: #138496;
    }

    .btn-deactivate {
        background: #dc3545;
        color: white;
    }

    .btn-deactivate:hover {
        background: #c82333;
    }

    .empty-message {
        text-align: center;
        padding: 2rem;
        color: #999;
    }

    .empty-icon {
        font-size: 2.25rem;
        color: #ddd;
        margin-bottom: 0.75rem;
    }

    .modal {
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

    .modal.show {
        display: flex;
    }

    .modal-content {
        background: white;
        border-radius: 8px;
        padding: 1.5rem;
        max-width: 460px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
        font-size: 1.05rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .modal-close-btn {
        background: none;
        border: none;
        font-size: 1.25rem;
        color: #999;
        cursor: pointer;
        padding: 0;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.3s ease;
    }

    .modal-close-btn:hover {
        color: #333;
    }

    .modal-body {
        margin-bottom: 1rem;
    }

    .detail-row {
        display: flex;
        margin-bottom: 0.85rem;
        align-items: flex-start;
        font-size: 0.9rem;
    }

    .detail-label {
        font-weight: 600;
        color: #555;
        min-width: 125px;
        margin-right: 0.75rem;
    }

    .detail-value {
        color: #333;
        flex: 1;
        line-height: 1.4;
    }

    .modal-message {
        color: #555;
        font-size: 0.9rem;
        line-height: 1.45;
        margin-bottom: 1rem;
    }

    .reason-label {
        display: block;
        font-weight: 600;
        color: #555;
        font-size: 0.85rem;
        margin-bottom: 0.45rem;
    }

    .reason-input {
        width: 100%;
        min-height: 95px;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 0.7rem;
        resize: vertical;
        font: inherit;
        font-size: 0.9rem;
    }

    .reason-input:focus {
        border-color: #2b7be4;
        box-shadow: 0 0 0 0.2rem rgba(43, 123, 228, 0.15);
        outline: none;
    }

    .modal-actions {
        display: flex;
        gap: 0.65rem;
        justify-content: flex-end;
        margin-top: 1rem;
    }

    .btn-modal {
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 0.55rem 0.9rem;
        transition: all 0.3s ease;
    }

    .btn-modal-primary {
        background: #2b7be4;
        color: white;
    }

    .btn-modal-primary:hover {
        background: #1e5fae;
    }

    .btn-modal-danger {
        background: #dc3545;
        color: white;
    }

    .btn-modal-danger:hover {
        background: #c82333;
    }

    .btn-modal-secondary {
        background: #f8f9fa;
        color: #555;
        border: 1px solid #ddd;
    }

    .btn-modal-secondary:hover {
        background: #e9ecef;
    }
</style>

<div class="approval-page">
    <!-- Header -->
    <div class="page-header">
        <h1 class="page-title fw-bold">
            <i class="fas fa-check-circle me-2" style="color: #2b7be4;"></i>Bus Operator Approval
        </h1>
        <p class="page-subtitle">Manage and review bus operator registrations</p>
    </div>

    <!-- Filter Section -->
    <div class="filter-section">
        <button class="filter-btn active" data-filter="inactive">
            <i class="fas fa-hourglass-half me-2"></i>Pending / Inactive
        </button>
        <button class="filter-btn" data-filter="active">
            <i class="fas fa-check me-2"></i>Approved / Active
        </button>
        <button class="filter-btn" data-filter="all">
            <i class="fas fa-list me-2"></i>All
        </button>
    </div>

    <!-- Table Section -->
    <div class="table-section">
        <table class="operators-table" id="operators-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="table-body">
                <tr>
                    <td colspan="6" class="empty-message">
                        <div class="empty-icon">
                            <i class="fas fa-inbox"></i>
                        </div>
                        No operators found
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<!-- Details Modal -->
<div class="modal" id="detailsModal">
    <div class="modal-content">
        <div class="modal-header">
            <span>Operator Details</span>
            <button class="modal-close-btn" onclick="closeDetailsModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="detail-row">
                <div class="detail-label">Full Name:</div>
                <div class="detail-value" id="modalOperatorName">N/A</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Email:</div>
                <div class="detail-value" id="modalOperatorEmail">N/A</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Company Name:</div>
                <div class="detail-value" id="modalOperatorCompany">N/A</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Company Address:</div>
                <div class="detail-value" id="modalOperatorCompanyAddress">N/A</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Company Email:</div>
                <div class="detail-value" id="modalOperatorCompanyEmail">N/A</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Company Contact:</div>
                <div class="detail-value" id="modalOperatorContact">N/A</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Fleet Size:</div>
                <div class="detail-value" id="modalOperatorFleetSize">N/A</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Status:</div>
                <div class="detail-value">
                    <span class="status-badge" id="modalOperatorStatus">N/A</span>
                </div>
            </div>
            <div class="detail-row" id="modalStatusReasonRow" style="display: none;">
                <div class="detail-label">Status Reason:</div>
                <div class="detail-value" id="modalStatusReason">N/A</div>
            </div>
        </div>
    </div>
</div>

<!-- Reason Modal -->
<div class="modal" id="statusReasonModal">
    <div class="modal-content">
        <div class="modal-header">
            <span id="statusReasonTitle">Add Reason</span>
            <button class="modal-close-btn" onclick="closeStatusReasonModal()">&times;</button>
        </div>
        <div class="modal-body">
            <p class="modal-message" id="statusReasonMessage"></p>
            <label class="reason-label" for="statusReasonInput" id="statusReasonLabel">Reason</label>
            <textarea class="reason-input" id="statusReasonInput" maxlength="500" placeholder="Enter the reason..."></textarea>
        </div>
        <div class="modal-actions">
            <button type="button" class="btn-modal btn-modal-secondary" onclick="closeStatusReasonModal()">Cancel</button>
            <button type="button" class="btn-modal btn-modal-primary" id="statusReasonSubmit" onclick="submitStatusReason()">Submit</button>
        </div>
    </div>
</div>

<!-- Script to pass operators data -->
<script>
    window.operatorsData = @json($operators);
</script>

<script src="{{ asset('js/approval.js') }}"></script>
@endsection
