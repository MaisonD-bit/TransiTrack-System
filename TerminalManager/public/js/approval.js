document.addEventListener('DOMContentLoaded', function() {
    initializeApprovalPage();
});

let currentOperatorId = null;
let currentFilter = 'inactive';
let operatorsRefreshTimer = null;
let isRefreshingOperators = false;
let pendingStatusChange = null;
const OPERATORS_REFRESH_INTERVAL = 5000;

function initializeApprovalPage() {
    // Attach filter button listeners
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderOperators();
        });
    });

    // Initial render
    renderOperators();
    refreshOperators();
    startOperatorsAutoRefresh();
}

function startOperatorsAutoRefresh() {
    if (operatorsRefreshTimer) {
        clearInterval(operatorsRefreshTimer);
    }

    operatorsRefreshTimer = setInterval(refreshOperators, OPERATORS_REFRESH_INTERVAL);
}

function refreshOperators() {
    if (isRefreshingOperators) return;

    isRefreshingOperators = true;

    fetch('/api/approvals/operators', {
        headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to load operators (${response.status})`);
        }

        return response.json();
    })
    .then(operators => {
        const nextOperators = Array.isArray(operators) ? operators : [];
        const currentOperators = Array.isArray(window.operatorsData) ? window.operatorsData : [];

        if (JSON.stringify(currentOperators) !== JSON.stringify(nextOperators)) {
            window.operatorsData = nextOperators;
            renderOperators();
            refreshOpenDetailsModal();
        }
    })
    .catch(error => {
        console.error('Error refreshing operators:', error);
    })
    .finally(() => {
        isRefreshingOperators = false;
    });
}

function refreshOpenDetailsModal() {
    const detailsModal = document.getElementById('detailsModal');

    if (!detailsModal || !detailsModal.classList.contains('show') || !currentOperatorId) {
        return;
    }

    const operator = window.operatorsData.find(op => op.id == currentOperatorId);

    if (!operator) {
        closeDetailsModal();
        return;
    }

    populateDetailsModal(operator);
}

function renderOperators() {
    const tableBody = document.getElementById('table-body');
    
    if (!window.operatorsData || window.operatorsData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-message">
                    <div class="empty-icon">
                        <i class="fas fa-inbox"></i>
                    </div>
                    No operators found
                </td>
            </tr>
        `;
        return;
    }

    // Filter operators
    let filteredOperators = window.operatorsData;
    if (currentFilter === 'inactive') {
        filteredOperators = window.operatorsData.filter(op => op.status === 'inactive');
    } else if (currentFilter === 'active') {
        filteredOperators = window.operatorsData.filter(op => op.status === 'active');
    }

    // If no results after filter
    if (filteredOperators.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-message">
                    <div class="empty-icon">
                        <i class="fas fa-inbox"></i>
                    </div>
                    No operators found
                </td>
            </tr>
        `;
        return;
    }

    // Render rows
    tableBody.innerHTML = filteredOperators.map(operator => `
        <tr>
            <td>
                <div class="operator-name">${escapeHtml(operator.name || 'N/A')}</div>
            </td>
            <td>${escapeHtml(operator.email || 'N/A')}</td>
            <td>
                <div class="operator-company">${escapeHtml(operator.company_name || 'N/A')}</div>
            </td>
            <td>${escapeHtml(operator.company_contact || 'N/A')}</td>
            <td>
                <span class="status-badge ${getOperatorStatusClass(operator)}">
                    ${getOperatorStatusLabel(operator)}
                </span>
            </td>
            <td>
                <div class="action-btns">
                    ${operator.status === 'inactive' ? `
                        <button class="btn-sm btn-approve" onclick="activateOperator(${operator.id})">Activate</button>
                    ` : `
                        <button class="btn-sm btn-deactivate" onclick="deactivateOperator(${operator.id})">Deactivate</button>
                    `}
                    <button class="btn-sm btn-view" onclick="viewOperator(${operator.id})">View</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function viewOperator(operatorId) {
    const operator = window.operatorsData.find(op => op.id == operatorId);
    if (!operator) {
        alert('Operator not found');
        return;
    }

    currentOperatorId = operatorId;
    populateDetailsModal(operator);

    // Show modal
    document.getElementById('detailsModal').classList.add('show');
}

function populateDetailsModal(operator) {
    document.getElementById('modalOperatorName').textContent = operator.name || 'N/A';
    document.getElementById('modalOperatorEmail').textContent = operator.email || 'N/A';
    document.getElementById('modalOperatorCompany').textContent = operator.company_name || 'N/A';
    document.getElementById('modalOperatorCompanyAddress').textContent = operator.company_address || 'N/A';
    document.getElementById('modalOperatorCompanyEmail').textContent = operator.company_email || 'N/A';
    document.getElementById('modalOperatorContact').textContent = operator.company_contact || 'N/A';
    document.getElementById('modalOperatorFleetSize').textContent = operator.fleet_size || 'N/A';
    document.getElementById('modalOperatorStatus').textContent = getOperatorStatusLabel(operator);
    document.getElementById('modalOperatorStatus').className = `status-badge ${getOperatorStatusClass(operator)}`;

    const reasonRow = document.getElementById('modalStatusReasonRow');
    const reasonValue = document.getElementById('modalStatusReason');
    if (operator.status_reason) {
        reasonValue.textContent = operator.status_reason;
        reasonRow.style.display = 'flex';
    } else {
        reasonValue.textContent = 'N/A';
        reasonRow.style.display = 'none';
    }
}

function activateOperator(operatorId) {
    const operatorName = getOperatorName(operatorId);

    if (!confirm(`Are you sure you want to activate ${operatorName}?`)) return;

    fetch(`/api/approvals/approve/${operatorId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || ''
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update local data
            const operator = window.operatorsData.find(op => op.id == operatorId);
            if (operator) {
                operator.status = 'active';
                operator.status_reason = null;
                operator.status_reason_action = null;
                operator.status_reason_at = null;
            }
            renderOperators();
            refreshOpenDetailsModal();
            refreshOperators();
            alert(`${operatorName} has been activated!`);
        } else {
            alert('Error activating operator: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to activate operator');
    });
}



function deactivateOperator(operatorId) {
    const operatorName = getOperatorName(operatorId);

    showStatusReasonModal({
        operatorId,
        action: 'deactivate',
        title: 'Deactivate Operator',
        message: `You may enter a reason for deactivating ${operatorName}. This will withdraw their access.`,
        label: 'Reason for deactivation (optional)',
        confirmText: 'Deactivate',
        required: false
    });
}

function showStatusReasonModal(config) {
    pendingStatusChange = config;

    const modal = document.getElementById('statusReasonModal');
    const title = document.getElementById('statusReasonTitle');
    const message = document.getElementById('statusReasonMessage');
    const label = document.getElementById('statusReasonLabel');
    const input = document.getElementById('statusReasonInput');
    const submit = document.getElementById('statusReasonSubmit');

    title.textContent = config.title;
    message.textContent = config.message;
    label.textContent = config.label;
    input.value = '';
    input.placeholder = 'Enter the reason, if needed...';
    submit.textContent = config.confirmText;
    submit.className = config.action === 'deactivate'
        ? 'btn-modal btn-modal-danger'
        : 'btn-modal btn-modal-primary';
    modal.classList.add('show');
    input.focus();
}

function closeStatusReasonModal() {
    const modal = document.getElementById('statusReasonModal');
    if (modal) {
        modal.classList.remove('show');
    }

    pendingStatusChange = null;
}

function submitStatusReason() {
    if (!pendingStatusChange) return;

    const input = document.getElementById('statusReasonInput');
    const error = document.getElementById('statusReasonError');
    const reason = input.value.trim();

    const { operatorId, action } = pendingStatusChange;
    const operatorName = getOperatorName(operatorId);

    fetch(`/api/approvals/pending/${operatorId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || ''
        },
        body: JSON.stringify({ action, reason })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update local data
            const operator = window.operatorsData.find(op => op.id == operatorId);
            if (operator) {
                operator.status = 'inactive';
                operator.status_reason = reason || null;
                operator.status_reason_action = action;
                operator.status_reason_at = new Date().toISOString();
            }
            renderOperators();
            refreshOpenDetailsModal();
            refreshOperators();
            closeStatusReasonModal();

            alert(`${operatorName} has been deactivated!`);
        } else {
            alert('Error updating operator: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to update operator');
    });
}

function getOperatorName(operatorId) {
    const operator = window.operatorsData.find(op => op.id == operatorId);
    return operator?.name || 'this operator';
}

function getOperatorStatusLabel(operator) {
    if (operator.status === 'active') return 'Approved';
    if (operator.status_reason_action === 'deactivate') return 'Inactive';
    return 'Pending';
}

function getOperatorStatusClass(operator) {
    return operator.status === 'active' ? 'status-approved' : 'status-pending';
}

// Utility function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
}

// Close details modal when clicking outside
document.addEventListener('DOMContentLoaded', function() {
    const detailsModal = document.getElementById('detailsModal');
    if (detailsModal) {
        detailsModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('show');
            }
        });
    }

    const statusReasonModal = document.getElementById('statusReasonModal');
    if (statusReasonModal) {
        statusReasonModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeStatusReasonModal();
            }
        });
    }
});

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('show');
    currentOperatorId = null;
}
