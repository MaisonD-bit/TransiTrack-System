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

// Show bus modal for adding new bus
function showBusModal() {
    document.getElementById('busForm').reset();
    document.getElementById('bus_id').value = '';
    document.getElementById('method_field').value = '';
    document.getElementById('modalTitleText').textContent = 'Add New Bus';
    document.getElementById('submitText').textContent = 'Save Bus';
    
    // Clear validation errors
    clearValidationErrors();
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('busModal'));
    modal.show();
}

// Edit bus function - FIXED
function editBus(busId) {
    console.log('Editing bus ID:', busId); // Debug log
    
    fetch(`/api/buses/${busId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Bus data received:', data); // Debug log
            
            //   Helper function to safely set element value
            const setElementValue = (id, value) => {
                const element = document.getElementById(id);
                if (element) {
                    element.value = value || '';
                    console.log(`Set ${id} to: ${value}`); // Debug log
                } else {
                    console.error(`Element with ID '${id}' not found`); // Debug log
                }
            };
            
            // Populate form fields with safe setter
            setElementValue('bus_id', data.id);
            setElementValue('bus_number', data.bus_number);
            setElementValue('plate_number', data.plate_number);
            setElementValue('model', data.model);
            setElementValue('capacity', data.capacity);
            setElementValue('accommodation_type', data.accommodation_type);
            setElementValue('bus_status', data.status); //   Note: form field is 'bus_status', not 'status'
            setElementValue('description', data.description);
            
            // Set method field for update
            const methodField = document.getElementById('method_field');
            if (methodField) {
                methodField.value = 'PUT';
            }
            
            // Update modal title and button text
            const modalTitle = document.getElementById('modalTitleText');
            const submitText = document.getElementById('submitText');
            
            if (modalTitle) modalTitle.textContent = 'Edit Bus';
            if (submitText) submitText.textContent = 'Update Bus';
            
            clearValidationErrors();
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('busModal'));
            modal.show();
        })
        .catch(error => {
            console.error('Error loading bus:', error);
            showToast('Failed to load bus details: ' + error.message, 'error');
        });
}

// Save bus function (handles both create and update)
function saveBus() {
    const form = document.getElementById('busForm');
    const formData = new FormData(form);
    const busId = document.getElementById('bus_id').value;
    const isEdit = busId !== '';
    
    // Determine URL and method
    const url = isEdit ? `/buses/${busId}` : '/buses';
    
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const originalText = submitText.textContent;
    
    submitBtn.disabled = true;
    submitText.textContent = 'Saving...';
    
    // Add method for Laravel
    if (isEdit) {
        formData.append('_method', 'PUT');
    }
    
    fetch(url, {
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
            showToast(data.message || 'Bus saved successfully', 'success');
            
            // Close modal
            const modalElement = document.getElementById('busModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
            
            // Reload page after a short delay
            setTimeout(() => window.location.reload(), 1000);
        } else {
            throw new Error(data.message || 'Unknown error occurred');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        
        if (error.errors) {
            showValidationErrors(error.errors);
        } else {
            let errorMessage = 'Error saving bus';
            
            if (error.errors) {
                const errors = Object.values(error.errors).flat();
                errorMessage = errors.join('\n');
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            showToast(errorMessage, 'error');
        }
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitText.textContent = originalText;
    });
}

// Delete bus function
function deleteBus(busId) {
    if (confirm('Are you sure you want to delete this bus? This action cannot be undone.')) {
        fetch(`/buses/${busId}`, {
            method: 'DELETE',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showToast(data.message || 'Bus deleted successfully', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } else {
                throw new Error(data.message || 'Unknown error occurred');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Error deleting bus: ' + (error.message || 'Unknown error'), 'error');
        });
    }
}

// Clear filters function
function clearFilters() {
    document.getElementById('search').value = '';
    document.getElementById('filter_status').value = '';
    document.getElementById('filter_accommodation').value = '';
    window.location.href = window.location.pathname;
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
        const input = document.getElementById(field);
        const errorDiv = document.getElementById(`${field}_error`);
        
        if (input && errorDiv) {
            input.classList.add('is-invalid');
            errorDiv.textContent = messages[0];
        }
    }
}

// Make functions globally available
window.showBusModal = showBusModal;
window.editBus = editBus;
window.deleteBus = deleteBus;
window.saveBus = saveBus;
window.clearFilters = clearFilters;

// DOM Content Loaded event listener
document.addEventListener('DOMContentLoaded', function() {
    console.log('Buses.js loaded'); // Debug log
    
    // Ensure CSRF token is available
    if (!document.querySelector('meta[name="csrf-token"]')) {
        console.error('CSRF token meta tag not found!');
        return;
    }

    // Add Bus button event listener
    const addBusBtn = document.getElementById('addBusBtn');
    if (addBusBtn) {
        addBusBtn.addEventListener('click', showBusModal);
        console.log('Add bus button listener attached'); // Debug log
    } else {
        console.error('Add bus button not found'); // Debug log
    }
    
    // Handle form submission with Enter key
    const busForm = document.getElementById('busForm');
    if (busForm) {
        busForm.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveBus();
            }
        });
    }
});