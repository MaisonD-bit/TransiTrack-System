@extends('layouts.app-sidebar')
@section('title', 'Terminal Spaces')
@section('content')
<style>
    .spaces-container {
        display: flex;
        gap: 16px;
        max-width: 100%;
        margin: 0 auto;
        padding: 20px;
        transition: all 0.3s ease;
        align-items: flex-start;
    }

    .svg-wrapper {
        flex: 1;
        min-width: 0;
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        transition: flex 0.3s ease;
        position: relative;
    }

    .svg-wrapper.with-panel {
        flex: 1;
    }

    /* SVG styling */
    svg {
        width: 100%;
        height: auto;
        display: block;
        background: #f5f5f5;
        border-radius: 6px;
    }

    /* Hover Tooltip - Terminal Manager Theme */
    .tooltip-bubble {
        display: none;
        position: fixed;
        background: white;
        border: none;
        border-radius: 8px;
        padding: 14px 18px;
        z-index: 1000;
        box-shadow: 0 4px 16px rgba(43, 123, 228, 0.2);
        min-width: 240px;
        text-align: center;
        pointer-events: auto;
    }

    /* Remove base pointer */
    .tooltip-bubble::after,
    .tooltip-bubble::before {
        display: none;
    }

    /* Side pointer variants */
    .tooltip-bubble.side-right::after {
        content: '';
        position: absolute;
        left: -10px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        border-right: 12px solid white;
        display: block;
    }

    .tooltip-bubble.side-right::before {
        content: '';
        position: absolute;
        left: -16px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        border-right: 12px solid rgba(43, 123, 228, 0.2);
        display: block;
    }

    .tooltip-bubble.side-left::after {
        content: '';
        position: absolute;
        right: -10px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        border-left: 12px solid white;
        display: block;
    }

    .tooltip-bubble.side-left::before {
        content: '';
        position: absolute;
        right: -16px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        border-left: 12px solid rgba(43, 123, 228, 0.2);
        display: block;
    }

    .tooltip-content {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .tooltip-header {
        font-weight: 700;
        margin-bottom: 2px;
        color: #1a1a1a;
        font-size: 13px;
        letter-spacing: 0.5px;
    }

    .tooltip-status-row {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
        font-size: 12px;
    }

    .tooltip-status {
        font-weight: 600;
        color: #28a745;
        font-size: 12px;
    }

    .tooltip-status.occupied {
        color: #dc3545;
    }

    .tooltip-time {
        font-weight: 700;
        color: #2b7be4;
        font-size: 12px;
        font-family: 'Courier New', monospace;
    }

    .tooltip-actions {
        display: flex;
        gap: 8px;
        margin-top: 6px;
        justify-content: center;
    }

    .tooltip-btn {
        padding: 5px 12px;
        font-size: 11px;
        border: 1px solid #2b7be4;
        border-radius: 4px;
        cursor: pointer;
        background: white;
        color: #2b7be4;
        font-weight: 700;
        transition: all 0.2s ease;
        min-width: 60px;
    }

    .tooltip-btn:hover {
        background: #2b7be4;
        color: white;
    }

    .tooltip-btn.cancel-btn {
        border-color: #dc3545;
        color: #dc3545;
    }

    .tooltip-btn.cancel-btn:hover {
        background: #dc3545;
        color: white;
    }

    /* Hover highlight for selected space */
    .space-bay-hovered {
        filter: brightness(1.2) drop-shadow(0 0 4px rgba(40, 167, 69, 0.8));
    }

    /* Legend */
    .legend {
        display: flex;
        gap: 24px;
        margin-top: 24px;
        flex-wrap: wrap;
        justify-content: center;
    }

    .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
    }

    .legend-color {
        width: 20px;
        height: 20px;
        border-radius: 3px;
    }

    /* Side Panel */
    .space-panel {
        width: 0;
        background: white;
        border-radius: 8px;
        padding: 0;
        box-shadow: none;
        display: none;
        flex-direction: column;
        gap: 18px;
        transition: all 0.3s ease;
        max-height: calc(100vh - 100px);
        overflow-y: auto;
        opacity: 0;
    }

    .space-panel.show {
        display: flex;
        width: 340px;
        padding: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        opacity: 1;
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding-bottom: 16px;
        border-bottom: 1px solid #e9ecef;
    }

    .panel-title {
        font-size: 18px;
        font-weight: 700;
        color: #1a1a1a;
    }

    .panel-subtitle {
        font-size: 12px;
        color: #666;
        margin-top: 2px;
    }

    .panel-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #999;
        padding: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s ease;
    }

    .panel-close:hover {
        color: #333;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .form-label {
        font-weight: 700;
        color: #333;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .form-control,
    select {
        border-radius: 6px;
        border: 1px solid #ddd;
        padding: 10px 12px;
        font-size: 13px;
        background: white;
    }

    .form-control:focus,
    select:focus {
        border-color: #2b7be4;
        box-shadow: 0 0 0 0.2rem rgba(43, 123, 228, 0.15);
        outline: none;
    }

    .form-control[readonly] {
        background-color: #f8f9fa;
        color: #555;
        cursor: not-allowed;
    }

    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
    }

    .time-input-group {
        display: flex;
        gap: 10px;
        align-items: flex-end;
    }

    .time-input-group .form-control {
        flex: 1;
    }

    .time-label {
        font-size: 12px;
        color: #666;
        font-weight: 600;
        min-width: 45px;
    }

    .countdown-display {
        font-size: 32px;
        font-weight: 700;
        color: #dc3545;
        background: #fff5f5;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        border: 1px solid #f1d5d5;
        font-family: 'Courier New', monospace;
        margin-top: 8px;
    }

    .panel-actions {
        display: flex;
        gap: 12px;
        margin-top: 12px;
    }

    .btn-action {
        flex: 1;
        padding: 11px;
        border-radius: 6px;
        border: none;
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .btn-mark-occupied {
        background: #2b7be4;
        color: white;
    }

    .btn-mark-occupied:hover {
        background: #1e5aa8;
    }

    .btn-cancel-action {
        background: #f8f9fa;
        color: #666;
        border: 1px solid #ddd;
    }

    .btn-cancel-action:hover {
        background: #e9ecef;
    }

    /* History Section */
    .history-section {
        margin-top: 40px;
        width: 100%;
    }

    .history-card {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        overflow: hidden;
        border: 1px solid #e9ecef;
    }

    .history-header {
        background: #1a1c30;
        padding: 20px 24px;
        border-bottom: none;
    }

    .history-header h6 {
        font-weight: 700;
        color: white;
        margin: 0;
        font-size: 16px;
        letter-spacing: 0.5px;
    }

    .history-body {
        padding: 24px;
        width: 100%;
        box-sizing: border-box;
    }

    .history-filters {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
        flex-wrap: wrap;
        width: 100%;
    }

    .history-filters input,
    .history-filters select {
        border-radius: 6px;
        border: 1px solid #ddd;
        padding: 10px 12px;
        font-size: 13px;
        background: white;
        transition: all 0.2s ease;
    }

    .history-filters input:focus,
    .history-filters select:focus {
        border-color: #2b7be4;
        box-shadow: 0 0 0 0.2rem rgba(43, 123, 228, 0.15);
        outline: none;
    }

    .history-table {
        font-size: 13px;
        width: 100%;
        table-layout: auto;
    }

    .history-table thead {
        background: #f8f9fa;
        border-bottom: 2px solid #e9ecef;
    }

    .history-table th {
        color: #555;
        font-weight: 700;
        padding: 14px;
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.5px;
    }

    .history-table tbody tr {
        border-bottom: 1px solid #f1f3f5;
        transition: background-color 0.2s ease;
    }

    .history-table tbody tr:hover {
        background-color: #f8f9fa;
    }

    .history-table td {
        padding: 14px;
        color: #333;
    }

    .pagination {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid #e9ecef;
        display: flex;
        justify-content: center;
        list-style: none;
        width: 100%;
        flex-wrap: wrap;
    }

    .pagination .page-item .page-link {
        border-radius: 6px;
        border: 1px solid #ddd;
        color: #2b7be4;
        background: white;
        font-weight: 600;
        transition: all 0.2s ease;
        margin: 0 4px;
    }

    .pagination .page-item .page-link:hover {
        background: #2b7be4;
        color: white;
        border-color: #2b7be4;
    }

    .pagination .page-item.active .page-link {
        background: #2b7be4;
        border-color: #2b7be4;
        color: white;
    }

    .pagination .page-item.disabled .page-link {
        color: #ccc;
        cursor: not-allowed;
    }

    nav[aria-label="Page navigation"] {
        display: block !important;
        width: 100% !important;
        margin-top: 24px !important;
        padding-top: 24px !important;
        border-top: 1px solid #e9ecef !important;
        clear: both !important;
    }

    .table-responsive {
        width: 100% !important;
        overflow-x: auto;
    }
</style>

<div class="container-fluid py-4">
    <!-- Header -->
    <div class="mb-4">
        <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center">
                <i class="fas fa-parking me-3 text-primary fs-4"></i>
                <h2 class="mb-0 fw-bold">South Terminal Parking Management</h2>
            </div>
            <div class="d-flex gap-2">
                <button type="button" class="btn btn-outline-primary btn-sm" onclick="refreshSpaces()">
                    <i class="fas fa-sync-alt me-1"></i> Refresh
                </button>
            </div>
        </div>
    </div>

    <!-- Main Container -->
    <div class="spaces-container" id="spacesContainer">
        <!-- SVG Terminal -->
        <div class="svg-wrapper" id="svgWrapper">
            <h6 class="text-center mb-4" style="color: #666; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Terminal Layout</h6>
            {!! file_get_contents(public_path('images/SouthBus_Layout.svg')) !!}

            <!-- Tooltip (Speech Bubble) -->
            <div class="tooltip-bubble" id="tooltip">
                <div class="tooltip-content">
                    <div class="tooltip-header" id="tooltipRoute">ROUTE NAME</div>
                    <div class="tooltip-status-row">
                        <span class="tooltip-status" id="tooltipStatus">Available</span>
                        <span class="tooltip-time" id="tooltipTime" style="display: none;">15:00</span>
                    </div>
                    <div class="tooltip-actions" id="tooltipActions">
                        <button class="tooltip-btn" onclick="editSpaceMode(event); event.stopPropagation();">EDIT</button>
                        <button class="tooltip-btn" onclick="occupySpace(event); event.stopPropagation();">OCCUPY</button>
                    </div>
                </div>
            </div>

            <!-- Legend -->
            <div class="legend">
                <div class="legend-item">
                    <div class="legend-color" style="background:#35d335;"></div>
                    <span>Available</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background:#dc3545;"></div>
                    <span>Occupied</span>
                </div>
            </div>
        </div>

        <!-- Right Side Panel -->
        <div class="space-panel" id="spacePanel">
            <div class="panel-header">
                <h3 class="panel-title">Space Details</h3>
                <button class="panel-close" onclick="closePanel()">×</button>
            </div>

            <div id="extensionRequestBanner" class="alert alert-warning py-2 px-3 small" style="display: none; margin: 0 12px 12px;">
                <div class="fw-semibold mb-1">Driver extension request</div>
                <div>Extra time requested: <span id="pendingExtensionMins">—</span> minutes</div>
                <div class="d-flex gap-2 mt-2 flex-wrap">
                    <button type="button" class="btn btn-sm btn-success" onclick="approveExtensionRequest(event)">Approve</button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="denyExtensionRequest(event)">Deny</button>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Route Name</label>
                <input type="text" class="form-control" id="panelRouteName">
            </div>

            <div class="form-group">
                <label class="form-label">Space ID</label>
                <input type="text" class="form-control" id="panelSpaceId" readonly>
            </div>

            <div class="form-group">
                <label class="form-label">Accommodation Type</label>
                <select class="form-control" id="panelAccommodationType">
                    <option value="">-- Select Type --</option>
                    <option value="Aircon">Aircon</option>
                    <option value="Non-Aircon">Non-Aircon</option>
                </select>
            </div>

            <div class="form-group" id="driverSection">
                <label class="form-label">Driver</label>
                <select class="form-control" id="panelDriver" onchange="fillCompanyOperator()">
                    <option value="">-- Select Driver --</option>
                    @forelse($drivers as $driver)
                    <option value="{{ $driver->id }}" data-company="{{ $driver->user->company_name ?? '' }}" data-operator-id="{{ $driver->user_id }}" data-operator="{{ $driver->user->name ?? '' }}">
                        {{ $driver->name }}
                    </option>
                    @empty
                    <option disabled>No drivers available</option>
                    @endforelse
                </select>
            </div>

            <div class="form-row" id="companyOperatorSection">
                <div class="form-group">
                    <label class="form-label">Operator</label>
                    <select class="form-control" id="panelOperator" onchange="fillCompanyFromOperator()">
                        <option value="">-- Select Operator --</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Company</label>
                    <input type="text" class="form-control" id="panelCompany" readonly>
                </div>
            </div>

            <div class="form-group" id="durationSection">
                <label class="form-label">Occupancy Duration</label>
                <div class="time-input-group">
                    <input type="number" class="form-control" id="panelTimeMinutes" min="1" max="360" value="15" onchange="updateCountdown()" step="1"> <span class="time-label">mins</span>
                </div>
            </div>

            <div class="countdown-display" id="countdownDisplay" style="display: none;">15:00</div>

            <div class="panel-actions">
                <button type="button" class="btn-action btn-mark-occupied" onclick="saveSpaceOccupancy()">
                    <i class="fas fa-check me-1"></i>Mark as Occupied
                </button>
                <button type="button" class="btn-action btn-cancel-action" onclick="closePanel()">Cancel</button>
            </div>
        </div>
    </div>

    <!-- History Section -->
    <div class="history-section">
        <div class="history-card">
            <div class="history-header">
                <h6><i class="fas fa-history me-2"></i>Terminal History</h6>
            </div>
            <div class="history-body">
                <div class="history-filters">
                    <div style="display: flex; flex-direction: column; gap: 4px; width: 100%; flex-basis: 100%; margin-bottom: 12px;">
                        <small style="color: #666; font-weight: 600; font-size: 11px; text-transform: uppercase;">Search</small>
                        <input type="text" class="form-control" id="searchFilter" placeholder="" style="width: 100%;" onchange="loadHistoryFromDatabase()">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 180px; max-width: 200px;">
                        <small style="color: #666; font-weight: 600; font-size: 11px; text-transform: uppercase;">From</small>
                        <input type="date" class="form-control" id="dateFromFilter" style="width: 100%;" onchange="loadHistoryFromDatabase()">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 180px; max-width: 200px;">
                        <small style="color: #666; font-weight: 600; font-size: 11px; text-transform: uppercase;">To</small>
                        <input type="date" class="form-control" id="dateToFilter" style="width: 100%;" onchange="loadHistoryFromDatabase()">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 180px; max-width: 200px;">
                        <small style="color: #666; font-weight: 600; font-size: 11px; text-transform: uppercase;">Status</small>
                        <select class="form-control" id="statusFilter" style="width: 100%;" onchange="loadHistoryFromDatabase()">
                            <option value="">All Statuses</option>
                            <option value="occupied">Occupied</option>
                            <option value="released">Released</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="edited">Edited</option>
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 180px; max-width: 200px;">
                        <small style="color: #666; font-weight: 600; font-size: 11px; text-transform: uppercase;">Driver</small>
                        <select class="form-control" id="driverFilter" style="width: 100%;" onchange="loadHistoryFromDatabase()">
                            <option value="">All Drivers</option>
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 180px; max-width: 200px;">
                        <small style="color: #666; font-weight: 600; font-size: 11px; text-transform: uppercase;">Route</small>
                        <select class="form-control" id="routeFilter" style="width: 100%;" onchange="loadHistoryFromDatabase()">
                            <option value="">All Routes</option>
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; justify-content: flex-end; min-width: 60px;">
                        <button type="button" class="btn btn-sm btn-outline-primary" onclick="downloadHistoryData()" title="Download History" style="height: 38px; width: 100%;">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle history-table">
                            <thead>
                                <tr>
                                    <th>Space ID</th>
                                    <th>Route</th>
                                    <th>Driver</th>
                                    <th>Action</th>
                                    <th>Time Occupied</th>
                                    <th>Time Released</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody id="historyTableBody">
                                <!-- Dynamically populated -->
                            </tbody>
                        </table>
                    </div>

                    <!-- WORKING PAGINATION -->
                    <nav aria-label="Page navigation">
                        <ul class="pagination pagination-sm justify-content-center" id="historyPagination">
                            <!-- Dynamically populated -->
                        </ul>
                    </nav>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal for COMPLETE/CANCEL Reason -->
    <div id="reasonModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 3000; justify-content: center; align-items: center;">
        <div style="background: white; border-radius: 12px; padding: 28px; max-width: 450px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <h3 id="reasonModalTitle" style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 20px; font-weight: 700;">Add Details</h3>

            <div style="margin-bottom: 20px;">
                <label style="font-weight: 700; color: #333; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">Notes (Optional)</label>
                <textarea id="reasonModalInput" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-family: inherit; font-size: 13px; resize: vertical; min-height: 80px;" placeholder="Enter any notes or reason..."></textarea>
            </div>

            <div style="display: flex; gap: 12px;">
                <button id="reasonModalConfirm" style="flex: 1; padding: 11px; border-radius: 6px; border: none; background: #2b7be4; color: white; font-weight: 700; font-size: 12px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;">Confirm</button>
                <button id="reasonModalCancel" style="flex: 1; padding: 11px; border-radius: 6px; border: 1px solid #ddd; background: #f8f9fa; color: #666; font-weight: 700; font-size: 12px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;">Close</button>
            </div>
        </div>
    </div>

    <script src="{{ asset('js/space.js') }}"></script>
    @endsection
