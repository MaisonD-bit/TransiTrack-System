// Dashboard functionality
function redirectTo(url) {
    window.location.href = url;
}

function quickSchedule() {
    window.location.href = '/panel/schedule';
}

function refreshDashboard() {
    location.reload();
}

function showIssuesModal() {
    const modal = new bootstrap.Modal(document.getElementById('issuesModal'));
    modal.show();
}

function viewScheduleDetails(scheduleId) {
    fetch(`/api/schedules/${scheduleId}`)
        .then(response => response.json())
        .then(data => {
            const content = `
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Driver:</strong> ${data.driver?.name || 'N/A'}</p>
                        <p><strong>Bus:</strong> ${data.bus?.bus_number || 'N/A'} (${data.bus?.model || 'N/A'})</p>
                        <p><strong>Route:</strong> ${data.route?.name || 'N/A'} (${data.route?.code || 'N/A'})</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Date:</strong> ${formatDate(data.date)}</p>
                        <p><strong>Time:</strong> ${data.start_time} - ${data.end_time}</p>
                        <p><strong>Status:</strong> <span class="badge bg-primary">${data.status}</span></p>
                    </div>
                </div>
                ${data.notes ? `<div class="mt-3"><strong>Notes:</strong><br>${data.notes}</div>` : ''}
            `;
            document.getElementById('scheduleDetailsContent').innerHTML = content;
            
            const modal = new bootstrap.Modal(document.getElementById('scheduleDetailsModal'));
            modal.show();
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Failed to load schedule details', 'error');
        });
}

function editSchedule(scheduleId) {
    window.location.href = `/panel/schedule?edit=${scheduleId}`;
}

function editFromModal() {
    // Close modal and redirect to edit
    const modal = bootstrap.Modal.getInstance(document.getElementById('scheduleDetailsModal'));
    modal.hide();
    // You can implement this based on your edit functionality
    window.location.href = '/panel/schedule';
}

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateString;
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `position-fixed top-0 end-0 m-3 alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show`;
    toast.style.zIndex = '9999';
    toast.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

// Filter functionality
function filterSchedules() {
    const statusFilter = document.getElementById('statusFilter').value;
    const table = document.getElementById('schedulesTable');
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const status = row.getAttribute('data-status');
        if (!statusFilter || status === statusFilter) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Real-time updates
function updateDashboardStats() {
    fetch('/api/operator/stats')
        .then(response => response.json())
        .then(data => {
            document.getElementById('totalSchedulesToday').textContent = data.todaySchedules || 0;
            document.getElementById('activeSchedules').textContent = data.activeSchedules || 0;
            document.getElementById('completedSchedules').textContent = data.completedSchedules || 0;
            document.getElementById('pendingSchedules').textContent = data.pendingSchedules || 0;
        })
        .catch(error => console.error('Error updating stats:', error));
}

// Auto-refresh functionality
function startAutoRefresh() {
    setInterval(() => {
        updateDashboardStats();
    }, 30000); // Refresh every 30 seconds
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl + N for new schedule
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            quickSchedule();
        }
        
        // Ctrl + R for refresh
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            refreshDashboard();
        }
    });
}

// Dashboard hover effects
function addHoverEffects() {
    const dashboardCards = document.querySelectorAll('.dashboard-card');
    dashboardCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.transition = 'transform 0.2s ease';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}

// Make functions globally available
window.redirectTo = redirectTo;
window.quickSchedule = quickSchedule;
window.refreshDashboard = refreshDashboard;
window.showIssuesModal = showIssuesModal;
window.viewScheduleDetails = viewScheduleDetails;
window.editSchedule = editSchedule;
window.editFromModal = editFromModal;
window.filterSchedules = filterSchedules;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Setup status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', filterSchedules);
    }
    
    // Add hover effects to dashboard cards
    addHoverEffects();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Start auto-refresh
    startAutoRefresh();
    
    // Initial stats update
    updateDashboardStats();
    
    console.log('Operator Dashboard initialized');
});