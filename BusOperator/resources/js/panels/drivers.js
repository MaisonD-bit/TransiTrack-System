let currentFormData = {};

// Toast notification function
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

function saveCurrentFormData() {
    const form = document.getElementById('driverForm');
    if (!form) return;

    currentFormData = {
        driver_id: document.getElementById('driver_id')?.value || '',
        name: document.getElementById('name')?.value || '',
        email: document.getElementById('email')?.value || '',
        contact_number: document.getElementById('contact_number')?.value || '',
        date_of_birth: document.getElementById('date_of_birth')?.value || '',
        gender: document.getElementById('gender')?.value || '',
        address: document.getElementById('address')?.value || '',
        license_number: document.getElementById('license_number')?.value || '',
        license_expiry: document.getElementById('license_expiry')?.value || '',
        emergency_name: document.getElementById('emergency_name')?.value || '',
        emergency_relation: document.getElementById('emergency_relation')?.value || '',
        emergency_contact: document.getElementById('emergency_contact')?.value || '',
        status: document.getElementById('status')?.value || 'active',
        notes: document.getElementById('notes')?.value || '',
        photo_preview: document.getElementById('photo-preview')?.src || ''
    };
}

function restoreFormData() {
    if (Object.keys(currentFormData).length === 0) return;

    const setFieldValue = (id, value) => {
        const element = document.getElementById(id);
        if (element && value !== undefined) {
            element.value = value;
        }
    };

    setFieldValue('driver_id', currentFormData.driver_id);
    setFieldValue('name', currentFormData.name);
    setFieldValue('email', currentFormData.email);
    setFieldValue('contact_number', currentFormData.contact_number);
    setFieldValue('date_of_birth', currentFormData.date_of_birth);
    setFieldValue('gender', currentFormData.gender);
    setFieldValue('address', currentFormData.address);
    setFieldValue('license_number', currentFormData.license_number);
    setFieldValue('license_expiry', currentFormData.license_expiry);
    setFieldValue('emergency_name', currentFormData.emergency_name);
    setFieldValue('emergency_relation', currentFormData.emergency_relation);
    setFieldValue('emergency_contact', currentFormData.emergency_contact);
    setFieldValue('status', currentFormData.status);
    setFieldValue('notes', currentFormData.notes);
    
    if (currentFormData.photo_preview) {
        const preview = document.getElementById('photo-preview');
        if (preview) {
            preview.src = currentFormData.photo_preview;
        }
    }
}

function showDriverForm() {
    const form = document.getElementById('driverForm');
    const formSection = document.getElementById('addDriverFormSection');
    
    if (form) form.reset();
    
    const setFieldValue = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.value = value;
    };

    setFieldValue('driver_id', '');
    setFieldValue('method_field', '');
    
    const formTitle = document.getElementById('formTitle');
    const submitText = document.getElementById('submitText');
    
    if (formTitle) formTitle.innerHTML = '<i class="fas fa-user-plus me-2"></i>Add New Driver';
    if (submitText) submitText.textContent = 'Save Driver';
    
    // Reset photo preview
    const preview = document.getElementById('photo-preview');
    if (preview) preview.src = 'https://randomuser.me/api/portraits/men/1.jpg';
    
    // Clear validation errors
    clearValidationErrors();
    
    // Clear stored form data for new driver
    currentFormData = {};
    
    if (formSection) {
        formSection.style.display = 'block';
        formSection.scrollIntoView({ behavior: 'smooth' });
    }
}

function hideDriverForm() {
    const formSection = document.getElementById('addDriverFormSection');
    if (formSection) {
        formSection.style.display = 'none';
    }
    // Don't reset form - preserve data
}

function showModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function hideModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
}

function toggleAddDriverForm() {
    const formSection = document.getElementById('addDriverFormSection');
    if (!formSection) return;
    
    if (formSection.style.display === 'none' || formSection.style.display === '') {
        showDriverForm();
    } else {
        hideDriverForm();
    }
}

function viewDriver(driverId) {
    window.location.href = `/panel/profile/${driverId}`;
}

function editDriver(driverId) {
    // Save current form data before loading new data
    saveCurrentFormData();
    
    fetch(`/api/drivers/${driverId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Driver data received:', data); //   Debug log
            
            // Show form
            const formSection = document.getElementById('addDriverFormSection');
            if (formSection) {
                formSection.style.display = 'block';
                formSection.scrollIntoView({ behavior: 'smooth' });
            }
            
            //   Helper function to format date for input[type="date"]
            const formatDateForInput = (dateString) => {
                if (!dateString) return '';
                
                // If already in YYYY-MM-DD format, return as is
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                    return dateString;
                }
                
                // Try to parse and format the date
                try {
                    const date = new Date(dateString);
                    if (isNaN(date.getTime())) return '';
                    
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    
                    return `${year}-${month}-${day}`;
                } catch (e) {
                    console.error('Date parsing error:', e);
                    return '';
                }
            };
            
            // Populate form fields
            const setFieldValue = (id, value) => {
                const element = document.getElementById(id);
                if (element) {
                    element.value = value || '';
                    console.log(`Set ${id} to:`, value); //   Debug log
                }
            };

            setFieldValue('driver_id', data.id);
            setFieldValue('name', data.name);
            setFieldValue('email', data.email);
            setFieldValue('contact_number', data.contact_number);
            
            //   Format and set date fields
            const formattedDOB = formatDateForInput(data.date_of_birth);
            const formattedExpiry = formatDateForInput(data.license_expiry);
            
            console.log('Formatted dates:', { 
                original_dob: data.date_of_birth, 
                formatted_dob: formattedDOB,
                original_expiry: data.license_expiry,
                formatted_expiry: formattedExpiry
            }); //   Debug log
            
            setFieldValue('date_of_birth', formattedDOB);
            setFieldValue('license_expiry', formattedExpiry);
            
            setFieldValue('gender', data.gender);
            setFieldValue('address', data.address);
            setFieldValue('license_number', data.license_number);
            setFieldValue('emergency_name', data.emergency_name);
            setFieldValue('emergency_relation', data.emergency_relation);
            setFieldValue('emergency_contact', data.emergency_contact);
            setFieldValue('status', data.status);
            setFieldValue('notes', data.notes);
            
            // Update photo preview
            const preview = document.getElementById('photo-preview');
            if (preview) {
                if (data.photo_url) {
                    preview.src = `/storage/${data.photo_url}`;
                } else {
                    preview.src = `https://randomuser.me/api/portraits/men/${data.id % 70}.jpg`;
                }
            }
            
            const methodField = document.getElementById('method_field');
            const formTitle = document.getElementById('formTitle');
            const submitText = document.getElementById('submitText');
            
            if (methodField) methodField.value = 'PUT';
            if (formTitle) formTitle.innerHTML = '<i class="fas fa-user-edit me-2"></i>Edit Driver';
            if (submitText) submitText.textContent = 'Update Driver';
            
            // Save the loaded data
            saveCurrentFormData();
            
            clearValidationErrors();
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Failed to load driver details', 'error');
            // Restore previous form data on error
            restoreFormData();
        });
}

function updateDriverStatus(driverId, newStatus) {
    const actionText = newStatus === 'active' ? 'activate' : 'deactivate';
    
    if (confirm(`Are you sure you want to ${actionText} this driver?`)) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]');
        if (!csrfToken) {
            showToast('CSRF token not found', 'error');
            return;
        }

        fetch(`/drivers/${driverId}/status`, {
            method: 'PUT',
            headers: {
                'X-CSRF-TOKEN': csrfToken.getAttribute('content'),
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
}

function toggleView(viewType) {
    const gridView = document.getElementById('gridView');
    const tableView = document.getElementById('tableView');
    const gridBtn = document.getElementById('gridViewBtn');
    const tableBtn = document.getElementById('tableViewBtn');
    
    if (viewType === 'grid') {
        if (gridView) gridView.style.display = 'block';
        if (tableView) tableView.style.display = 'none';
        if (gridBtn) gridBtn.classList.add('active');
        if (tableBtn) tableBtn.classList.remove('active');
    } else {
        if (gridView) gridView.style.display = 'none';
        if (tableView) tableView.style.display = 'block';
        if (tableBtn) tableBtn.classList.add('active');
        if (gridBtn) gridBtn.classList.remove('active');
    }
}

function clearFilters() {
    const searchInput = document.getElementById('driverSearch');
    const statusFilter = document.getElementById('statusFilter');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = '';
    
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) clearSearchBtn.style.display = 'none';
    
    // Reset visibility of all driver cards and table rows
    filterDrivers('');
    
    window.location.href = window.location.pathname;
}

function filterDrivers(searchTerm) {
    searchTerm = searchTerm.toLowerCase().trim();
    
    // Filter grid view
    const gridView = document.getElementById('gridView');
    if (gridView) {
        const driverCards = gridView.querySelectorAll('.col-xl-3.col-lg-4.col-md-6');
        let visibleCount = 0;
        
        driverCards.forEach(card => {
            const name = card.querySelector('h5')?.textContent.toLowerCase() || '';
            const driverId = card.querySelector('.text-muted')?.textContent.toLowerCase() || '';
            const email = card.querySelector('a[href^="mailto:"]')?.textContent.toLowerCase() || '';
            const phone = card.querySelector('a[href^="tel:"]')?.textContent.toLowerCase() || '';
            
            const matches = !searchTerm || 
                           name.includes(searchTerm) || 
                           driverId.includes(searchTerm) || 
                           email.includes(searchTerm) || 
                           phone.includes(searchTerm);
            
            card.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });
        
        // Show "no results" message if needed
        const emptyMessage = gridView.querySelector('.col-12:has(i.fa-users-slash)');
        if (emptyMessage) {
            emptyMessage.style.display = visibleCount === 0 && searchTerm ? '' : 'none';
        }
    }
    
    // Filter table view
    const tableBody = document.getElementById('performanceTableBody');
    if (tableBody) {
        const rows = tableBody.querySelectorAll('tr');
        let visibleCount = 0;
        
        rows.forEach(row => {
            const name = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
            const email = row.querySelector('td:nth-child(3)')?.textContent.toLowerCase() || '';
            const phone = row.querySelector('td:nth-child(4)')?.textContent.toLowerCase() || '';
            
            const matches = !searchTerm || 
                           name.includes(searchTerm) || 
                           email.includes(searchTerm) || 
                           phone.includes(searchTerm);
            
            row.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });
    }
}

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

function approveDriver(driverId) {
    updateDriverStatus(driverId, 'active');
}

function rejectDriver(driverId) {
    updateDriverStatus(driverId, 'rejected');
}

// Make functions globally available
window.showDriverForm = showDriverForm;
window.hideDriverForm = hideDriverForm;
window.toggleAddDriverForm = toggleAddDriverForm;
window.viewDriver = viewDriver;
window.editDriver = editDriver;
// window.deleteDriver = deleteDriver;
window.updateDriverStatus = updateDriverStatus;
window.toggleView = toggleView;
window.clearFilters = clearFilters;
window.filterDrivers = filterDrivers;
window.approveDriver = approveDriver;
window.rejectDriver = rejectDriver;

// DOMContentLoaded event

let driverToDelete = null;

function deleteDriver(driverId) {
    driverToDelete = driverId;
    showModal('deleteDriverModal');
}

window.deleteDriver = deleteDriver;

document.addEventListener('DOMContentLoaded', function() {
    // Ensure CSRF token is available
    const csrfToken = document.querySelector('meta[name="csrf-token"]');
    if (!csrfToken) {
        console.error('CSRF token meta tag not found!');
        return;
    }

    // Add Driver button event listeners
    const addDriverBtn = document.getElementById('addDriverBtn');
    if (addDriverBtn) {
        addDriverBtn.addEventListener('click', function() {
            // Reset form for new driver
            const form = document.getElementById('driverForm');
            if (form) form.reset();
            
            const setFieldValue = (id, value) => {
                const element = document.getElementById(id);
                if (element) element.value = value;
            };

            setFieldValue('driver_id', '');
            setFieldValue('method_field', '');
            
            const formTitle = document.getElementById('formTitle');
            const submitText = document.getElementById('submitText');
            const preview = document.getElementById('photo-preview');
            
            if (formTitle) formTitle.innerHTML = '<i class="fas fa-user-plus me-2"></i>Add New Driver';
            if (submitText) submitText.textContent = 'Save Driver';
            if (preview) preview.src = 'https://randomuser.me/api/portraits/men/1.jpg';
            
            // Clear stored data for new driver
            currentFormData = {};
            
            showDriverForm();
        });
    }

    document.getElementById('confirmDeleteDriverBtn').addEventListener('click', function() {
        if (!driverToDelete) return;
        const csrfToken = document.querySelector('meta[name="csrf-token"]');
        fetch(`/drivers/${driverToDelete}`, {
            method: 'DELETE',
            headers: {
                'X-CSRF-TOKEN': csrfToken.getAttribute('content'),
                'Accept': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            showToast(data.message || 'Driver deleted successfully', data.success ? 'success' : 'error');
            setTimeout(() => window.location.reload(), 1000);
        })
        .catch(error => {
            showToast('Error deleting driver', 'error');
        })
        .finally(() => {
            driverToDelete = null;
            hideModal('deleteDriverModal');
        });
    });

    document.getElementById('cancelDeleteDriverBtn').addEventListener('click', function() {
        driverToDelete = null;
        hideModal('deleteDriverModal');
    });
    
    // Search functionality
    const driverSearch = document.getElementById('driverSearch');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (driverSearch) {
        // Real-time search as user types
        driverSearch.addEventListener('input', function() {
            const searchTerm = this.value.trim();
            filterDrivers(searchTerm);
            
            // Show/hide clear button
            if (clearSearchBtn) {
                clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
            }
        });
        
        // Handle Enter key
        driverSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterDrivers(this.value.trim());
            }
        });
    }
    
    // Clear search button
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            if (driverSearch) driverSearch.value = '';
            this.style.display = 'none';
            filterDrivers('');
        });
    }
    
    // Add First Driver buttons
    const addFirstDriverBtn = document.getElementById('addFirstDriverBtn');
    const addFirstDriverBtnTable = document.getElementById('addFirstDriverBtnTable');
    
    if (addFirstDriverBtn && addDriverBtn) {
        addFirstDriverBtn.addEventListener('click', function() {
            addDriverBtn.click();
        });
    }
    
    if (addFirstDriverBtnTable && addDriverBtn) {
        addFirstDriverBtnTable.addEventListener('click', function() {
            addDriverBtn.click();
        });
    }
    
    // Photo upload functionality
    const photoContainer = document.querySelector('#photo-preview')?.parentElement;
    const photoInput = document.getElementById('photo');
    const photoPreview = document.getElementById('photo-preview');
    const photoOverlay = document.querySelector('.photo-overlay');

    // Show overlay on hover
    if (photoContainer && photoOverlay) {
        photoContainer.addEventListener('mouseenter', function() {
            photoOverlay.style.opacity = '1';
        });
        
        photoContainer.addEventListener('mouseleave', function() {
            photoOverlay.style.opacity = '0';
        });
    }

    if (photoContainer && photoInput) {
        photoContainer.addEventListener('click', function() {
            photoInput.click();
        });
    }

    if (photoInput && photoPreview) {
        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    photoPreview.src = e.target.result;
                    // Update stored data
                    if (currentFormData) {
                        currentFormData.photo_preview = e.target.result;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Auto-save form data on input changes
    const formInputs = document.querySelectorAll('#driverForm input, #driverForm select, #driverForm textarea');
    formInputs.forEach(input => {
        input.addEventListener('input', saveCurrentFormData);
        input.addEventListener('change', saveCurrentFormData);
    });
    
    // Form submission with better error handling and data preservation
    const driverForm = document.getElementById('driverForm');
    if (driverForm) {
        driverForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Save current form data before submission
            saveCurrentFormData();
            
            const formData = new FormData(this);
            const driverId = document.getElementById('driver_id')?.value || '';
            const isEdit = driverId !== '';
            
            // Determine the correct URL and method
            let url = '/drivers';
            if (isEdit) {
                url = `/drivers/${driverId}`;
                formData.append('_method', 'PUT');
            }
            
            const submitBtn = document.getElementById('submitBtn');
            const submitText = document.getElementById('submitText');
            const originalText = submitText?.textContent || 'Save';
            
            if (submitBtn) submitBtn.disabled = true;
            if (submitText) submitText.textContent = 'Saving...';
            
            fetch(url, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-TOKEN': csrfToken.getAttribute('content'),
                    'Accept': 'application/json',
                },
                credentials: 'same-origin'
            })
            .then(response => {
                console.log('Response status:', response.status);
                
                if (!response.ok) {
                    return response.text().then(text => {
                        console.error('Error response:', text);
                        let errorData;
                        try {
                            errorData = JSON.parse(text);
                        } catch (e) {
                            throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}...`);
                        }
                        
                        // Handle validation errors
                        if (errorData.errors) {
                            showValidationErrors(errorData.errors);
                            // Restore form data after validation error
                            setTimeout(() => restoreFormData(), 100);
                            throw new Error('Validation failed. Please check the form.');
                        }
                        
                        throw new Error(errorData.message || `HTTP ${response.status}`);
                    });
                }
                
                return response.json();
            })
            .then(data => {
                console.log('Success response:', data);
                if (data.success) {
                    showToast(data.message || 'Driver saved successfully', 'success');
                    // Clear stored data on successful save
                    currentFormData = {};
                    hideDriverForm();
                    setTimeout(() => location.reload(), 1000);
                } else {
                    console.error('Server returned error:', data);
                    showToast('Error: ' + (data.message || 'Unknown error'), 'error');
                    // Restore form data on error
                    restoreFormData();
                }
            })
            .catch(error => {
                console.error('Fetch error:', error);
                showToast('Error saving driver: ' + error.message, 'error');
                // Restore form data on error
                restoreFormData();
            })
            .finally(() => {
                if (submitBtn) submitBtn.disabled = false;
                if (submitText) submitText.textContent = originalText;
            });
        });
    }
    
    // View toggle functionality
    const tableViewBtn = document.getElementById('tableViewBtn');
    const gridViewBtn = document.getElementById('gridViewBtn');
    const tableView = document.getElementById('tableView');
    const gridView = document.getElementById('gridView');

    if (tableViewBtn && gridViewBtn && tableView && gridView) {
        tableViewBtn.addEventListener('click', function() {
            tableView.style.display = 'block';
            gridView.style.display = 'none';
            tableViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
            // Initialize charts when table view is shown
            setTimeout(() => initializeCharts(), 200);
        });

        gridViewBtn.addEventListener('click', function() {
            gridView.style.display = 'block';
            tableView.style.display = 'none';
            gridViewBtn.classList.add('active');
            tableViewBtn.classList.remove('active');
        });
    }

    // Initialize charts on page load if needed
    setTimeout(() => initializeCharts(), 500);
});

// Chart instances
let ratingsChart = null;
let punctualityChart = null;

// Initialize performance charts
function initializeCharts() {
    const ratingCanvas = document.getElementById('ratingsChart');
    const punctualityCanvas = document.getElementById('punctualityChart');
    
    if (!ratingCanvas || !punctualityCanvas) return;
    
    // Get driver data from the table
    const drivers = [];
    const rows = document.querySelectorAll('#performanceTableBody tr');
    
    rows.forEach(row => {
        const name = row.querySelector('td:nth-child(1) strong')?.textContent || '';
        const ratingCell = row.querySelector('td:nth-child(3)');
        const punctualityCell = row.querySelector('td:nth-child(4)');
        
        if (name && name !== 'Unnamed') {
            // Extract rating (count of filled stars)
            const stars = ratingCell?.querySelectorAll('.fa-star.text-warning') || [];
            const rating = stars.length;
            
            // Extract punctuality percentage
            const punctualityText = punctualityCell?.textContent || '0%';
            const punctuality = parseInt(punctualityText.match(/\d+/)?.[0] || 0);
            
            drivers.push({ name, rating, punctuality });
        }
    });
    
    // Destroy existing charts
    if (ratingsChart) ratingsChart.destroy();
    if (punctualityChart) punctualityChart.destroy();
    
    // Create Ratings Chart
    const ratingsCtx = ratingCanvas.getContext('2d');
    ratingsChart = new Chart(ratingsCtx, {
        type: 'bar',
        data: {
            labels: drivers.map(d => d.name),
            datasets: [{
                label: 'Rating (out of 5)',
                data: drivers.map(d => d.rating),
                backgroundColor: drivers.map(d => {
                    if (d.rating >= 4) return '#28a745';
                    if (d.rating >= 3) return '#ffc107';
                    return '#dc3545';
                }),
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 5,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
    
    // Create Punctuality Chart
    const punctualityCtx = punctualityCanvas.getContext('2d');
    punctualityChart = new Chart(punctualityCtx, {
        type: 'bar',
        data: {
            labels: drivers.map(d => d.name),
            datasets: [{
                label: 'Punctuality Rate (%)',
                data: drivers.map(d => d.punctuality),
                backgroundColor: '#28a745',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { stepSize: 20 }
                }
            }
        }
    });
}

// Apply date filter
function applyDateFilter() {
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    
    if (startDate && endDate) {
        showToast('Date filter applied', 'info');
        // You can add API call here to fetch filtered data
        // For now, just reinitialize charts with current data
        setTimeout(() => initializeCharts(), 300);
    }
}

// Refresh performance data
function refreshPerformanceData() {
    showToast('Refreshing performance data...', 'info');
    location.reload();
}