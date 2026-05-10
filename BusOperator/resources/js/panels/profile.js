// Toast notification function (same as other panels)
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

// Apply date filter function
function applyDateFilter() {
    const fromDate = document.getElementById('from_date').value;
    const toDate = document.getElementById('to_date').value;
    const routeId = document.getElementById('route_id').value;
    const busId = document.getElementById('bus_id').value;
    
    // Extract driver ID from URL more reliably
    const pathParts = window.location.pathname.split('/').filter(part => part.length > 0);
    const driverId = pathParts[pathParts.length - 1];
    
    if (!driverId || isNaN(driverId)) {
        console.error('Could not extract driver ID from URL');
        return;
    }
    
    // Build query string
    let queryParams = [];
    if (fromDate) queryParams.push(`from_date=${encodeURIComponent(fromDate)}`);
    if (toDate) queryParams.push(`to_date=${encodeURIComponent(toDate)}`);
    if (routeId) queryParams.push(`route_id=${encodeURIComponent(routeId)}`);
    if (busId) queryParams.push(`bus_id=${encodeURIComponent(busId)}`);
    
    const queryString = queryParams.length > 0 ? '?' + queryParams.join('&') : '';
    
    // Store scroll position and apply filter
    const scrollPos = document.getElementById('schedules-filter').offsetTop - 100;
    sessionStorage.setItem('scheduleScrollPos', scrollPos);
    
    window.location.href = `/panel/profile/${driverId}${queryString}`;
}

// Clear date filter function
function clearDateFilter() {
    // Extract driver ID from URL more reliably
    const pathParts = window.location.pathname.split('/').filter(part => part.length > 0);
    const driverId = pathParts[pathParts.length - 1];
    
    if (!driverId || isNaN(driverId)) {
        console.error('Could not extract driver ID from URL');
        return;
    }
    
    // Store scroll position before clearing
    const scrollPos = document.getElementById('schedules-filter').offsetTop - 100;
    sessionStorage.setItem('scheduleScrollPos', scrollPos);
    
    window.location.href = `/panel/profile/${driverId}`;
}

// Edit driver function
function editDriver(id) {
    const modal = new bootstrap.Modal(document.getElementById('editDriverModal'));
    modal.show();
}

// Delete driver function
function deleteDriver(id) {
    // Store the driver ID for use in confirmation
    window.pendingDeleteId = id;
    
    // Show the confirmation modal
    const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
    modal.show();
}

// Perform the actual delete
function performDeleteDriver() {
    const id = window.pendingDeleteId;
    if (!id) return;
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal'));
    modal.hide();
    
    fetch(`/drivers/${id}`, {
        method: 'DELETE',
        headers: {
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || 'Driver deleted successfully', 'success');
            setTimeout(() => {
                window.location.href = window.driversRoute || '/drivers';
            }, 1000);
        } else {
            showToast('Error deleting driver: ' + (data.message || 'Unknown error'), 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error deleting driver', 'error');
    });
}

// Toggle driver status function
function toggleDriverStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';
    
    // Store values for use in confirmation
    window.pendingToggleId = id;
    window.pendingNewStatus = newStatus;
    
    // Update modal text
    const titleText = action.charAt(0).toUpperCase() + action.slice(1) + ' Driver';
    document.getElementById('toggleStatusTitle').textContent = titleText;
    document.getElementById('toggleStatusAction').textContent = action;
    document.getElementById('toggleStatusBtnText').textContent = action.charAt(0).toUpperCase() + action.slice(1);
    
    // Show the confirmation modal
    const modal = new bootstrap.Modal(document.getElementById('confirmToggleStatusModal'));
    modal.show();
}

// Perform the actual status toggle
function performToggleStatus() {
    const id = window.pendingToggleId;
    const newStatus = window.pendingNewStatus;
    
    if (!id || !newStatus) return;
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmToggleStatusModal'));
    modal.hide();
    
    fetch(`/drivers/${id}/status`, {
        method: 'PUT',
        headers: {
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || 'Driver status updated successfully', 'success');
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast('Error updating status: ' + (data.message || 'Unknown error'), 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error updating driver status', 'error');
    });
}

// Save driver changes function
function saveDriverChanges() {
    const form = document.getElementById('editDriverForm');
    const formData = new FormData(form);
    const driverId = document.getElementById('edit_driver_id').value;
    
    const saveBtn = document.getElementById('saveDriverBtn');
    const saveText = document.getElementById('saveDriverText');
    const originalText = saveText.textContent;
    
    // Clear previous validation errors
    clearValidationErrors();
    
    saveBtn.disabled = true;
    saveText.textContent = 'Saving...';
    
    fetch(`/drivers/${driverId}`, {
        method: 'POST',
        body: formData,
        headers: {
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
            'Accept': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => Promise.reject(err));
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showToast(data.message || 'Driver updated successfully', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('editDriverModal'));
            modal.hide();
            setTimeout(() => location.reload(), 1000);
        } else {
            throw new Error(data.message || 'Unknown error occurred');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        
        if (error.errors) {
            showValidationErrors(error.errors);
            showToast('Please check the form for errors', 'error');
        } else {
            showToast('Error updating driver: ' + (error.message || 'Unknown error'), 'error');
        }
    })
    .finally(() => {
        saveBtn.disabled = false;
        saveText.textContent = originalText;
    });
}

// Clear validation errors
function clearValidationErrors() {
    const inputs = document.querySelectorAll('.form-control, .form-select');
    inputs.forEach(input => {
        input.classList.remove('is-invalid');
    });
    
    const errorDivs = document.querySelectorAll('.invalid-feedback');
    errorDivs.forEach(div => {
        div.textContent = '';
    });
}

// Show validation errors
function showValidationErrors(errors) {
    clearValidationErrors();
    
    for (const [field, messages] of Object.entries(errors)) {
        const input = document.getElementById(`edit_${field}`);
        const errorDiv = document.getElementById(`edit_${field}_error`);
        
        if (input && errorDiv) {
            input.classList.add('is-invalid');
            errorDiv.textContent = messages[0];
        }
    }
}

// Make functions globally available
window.editDriver = editDriver;
window.deleteDriver = deleteDriver;
window.performDeleteDriver = performDeleteDriver;
window.toggleDriverStatus = toggleDriverStatus;
window.performToggleStatus = performToggleStatus;
window.saveDriverChanges = saveDriverChanges;
window.applyDateFilter = applyDateFilter;
window.clearDateFilter = clearDateFilter;

// DOMContentLoaded event
document.addEventListener('DOMContentLoaded', function() {
    // Restore scroll position if filters were applied
    const scrollPos = sessionStorage.getItem('scheduleScrollPos');
    if (scrollPos) {
        setTimeout(function() {
            window.scrollTo(0, parseInt(scrollPos));
            sessionStorage.removeItem('scheduleScrollPos');
        }, 100);
    }
    
    // Photo upload functionality
    const photoContainer = document.querySelector('#edit-photo-preview').parentElement;
    const photoInput = document.getElementById('edit_photo');
    const photoPreview = document.getElementById('edit-photo-preview');

    photoContainer?.addEventListener('click', function() {
        photoInput.click();
    });

    photoInput?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                photoPreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Save button click handler
    document.getElementById('saveDriverBtn')?.addEventListener('click', saveDriverChanges);
    
    // Confirmation button handlers
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', performDeleteDriver);
    document.getElementById('confirmToggleStatusBtn')?.addEventListener('click', performToggleStatus);
    
    // Set the drivers route for navigation
    window.driversRoute = document.querySelector('a[href*="drivers.panel"]')?.getAttribute('href') || '/drivers';
});