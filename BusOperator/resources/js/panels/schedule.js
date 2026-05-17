/**
 * Feedback modal — same layout as Schedule Conflict / Delete modals (Bootstrap, centered, colored header).
 */
function showScheduleFeedbackModal(message, type = 'info', options = {}) {
    const modalEl = document.getElementById('scheduleFeedbackModal');
    if (!modalEl) {
        window.alert(message);
        if (typeof options.onOk === 'function') options.onOk();
        return;
    }

    const header = modalEl.querySelector('#scheduleFeedbackModalHeader');
    const title = modalEl.querySelector('#scheduleFeedbackModalTitle');
    const body = modalEl.querySelector('#scheduleFeedbackModalBody');
    const okBtn = modalEl.querySelector('#scheduleFeedbackModalOkBtn');

    header.className = 'modal-header';
    const styles = {
        error: { bg: 'bg-danger text-white', icon: 'fa-times-circle', label: 'Cannot save' },
        success: { bg: 'bg-success text-white', icon: 'fa-check-circle', label: 'Success' },
        warning: { bg: 'bg-warning text-dark', icon: 'fa-exclamation-triangle', label: 'Notice' },
        info: { bg: 'bg-primary text-white', icon: 'fa-info-circle', label: 'Notice' },
    };
    const s = styles[type] || styles.info;
    header.classList.add(...s.bg.split(/\s+/));
    title.innerHTML = `<i class="fas ${s.icon} me-2"></i>${s.label}`;
    body.textContent = message;

    const closeBtn = modalEl.querySelector('.modal-header .btn-close');
    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);

    const finish = () => {
        hideModal('scheduleFeedbackModal');
        if (typeof options.onOk === 'function') options.onOk();
    };

    newOk.addEventListener('click', finish);

    if (closeBtn) {
        const newClose = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);
        if (type === 'warning') {
            newClose.classList.remove('btn-close-white');
        } else {
            newClose.classList.add('btn-close-white');
        }
        newClose.addEventListener('click', () => hideModal('scheduleFeedbackModal'));
    }

    showModal('scheduleFeedbackModal');
}

// Double booking modal function
function showDoubleBookingModal(message) {
    const messageEl = document.getElementById('doubleBookingMessage');
    if (messageEl) {
        messageEl.textContent = message;
    }
    showModal('doubleBookingModal');
}

/** Today as YYYY-MM-DD (local) */
function scheduleTodayYmd() {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Now as HH:MM (local) for <input type="time"> */
function scheduleNowHm() {
    const t = new Date();
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

/**
 * Enforce: date cannot be before today; if date is today, start time cannot be before now.
 */
function applyScheduleRowConstraints(row) {
    const dateInput = row.querySelector('.date-input');
    const startInput = row.querySelector('.start-time-input');
    const endInput = row.querySelector('.end-time-input');
    const routeSelect = row.querySelector('.route-select');
    const busSelect = row.querySelector('.bus-select');

    if (!dateInput || !startInput) return;

    const todayStr = scheduleTodayYmd();
    dateInput.min = todayStr;
    if (dateInput.value && dateInput.value < todayStr) {
        dateInput.value = todayStr;
    }

    if (dateInput.value === todayStr) {
        const nowHm = scheduleNowHm();
        startInput.min = nowHm;
        if (startInput.value && startInput.value < nowHm) {
            startInput.value = nowHm;
            if (routeSelect && endInput) {
                calculateEndTime(routeSelect, startInput, endInput);
                updateFareInputs(row, routeSelect, busSelect);
            }
        }
    } else {
        startInput.removeAttribute('min');
    }
}

/**
 * Client-side check before POST (same rules as server; friendly messages).
 */
function scheduleRowEpochRange(dateStr, startHm, endHm, endsNextDay) {
    const start = new Date(`${dateStr}T${startHm}:00`).getTime();
    let end = new Date(`${dateStr}T${endHm}:00`).getTime();
    if (endsNextDay) {
        end += 86400000;
    }
    return { start, end };
}

function validateBulkScheduleRowsBeforeSave() {
    const container = document.getElementById('schedulesContainer');
    if (!container) return null;
    const rows = container.querySelectorAll('.schedule-row');
    const todayStr = scheduleTodayYmd();
    const nowHm = scheduleNowHm();

    const byDriver = {};

    for (let i = 0; i < rows.length; i++) {
        applyScheduleRowConstraints(rows[i]);
        const n = i + 1;
        const dateIn = rows[i].querySelector('.date-input');
        const startIn = rows[i].querySelector('.start-time-input');
        const endIn = rows[i].querySelector('.end-time-input');
        if (!dateIn || !startIn || !endIn) continue;

        const d = dateIn.value;
        const s = startIn.value;
        const e = endIn.value;
        const endsNext = rows[i].querySelector('.ends-next-day-hidden')?.value === '1';

        if (!d || !s || !e) continue;

        if (d < todayStr) {
            return `Schedule ${n}: date cannot be before today.`;
        }
        if (d === todayStr && s < nowHm) {
            return `Schedule ${n}: start time cannot be in the past (it must be after ${nowHm}).`;
        }
        if (!endsNext && s >= e) {
            return `Schedule ${n}: end time must be after start time on the same day, or enable next-day end when the trip crosses midnight.`;
        }

        const driverInput = rows[i].querySelector('.driver_id_input');
        const driverId = driverInput ? String(driverInput.value) : '';
        if (!driverId) continue;

        const ra = scheduleRowEpochRange(d, s, e, endsNext);
        if (ra.end <= ra.start) {
            return `Schedule ${n}: invalid time range.`;
        }

        if (!byDriver[driverId]) byDriver[driverId] = [];
        byDriver[driverId].push({ n, start: ra.start, end: ra.end });
    }

    for (const driverId of Object.keys(byDriver)) {
        const list = byDriver[driverId];
        for (let a = 0; a < list.length; a++) {
            for (let b = a + 1; b < list.length; b++) {
                if (list[a].start < list[b].end && list[a].end > list[b].start) {
                    return `Schedule ${list[a].n} and Schedule ${list[b].n} overlap for this driver. Choose different times.`;
                }
            }
        }
    }

    const byBusDate = {};
    for (let kb = 0; kb < rows.length; kb++) {
        const busSel = rows[kb].querySelector('.bus-select');
        const dateIn = rows[kb].querySelector('.date-input');
        if (!busSel || !dateIn) continue;
        const busId = busSel.value;
        const d = dateIn.value;
        if (!busId || !d) continue;
        const key = busId + '|' + d;
        if (!byBusDate[key]) byBusDate[key] = [];
        byBusDate[key].push(kb + 1);
    }
    for (const key of Object.keys(byBusDate)) {
        const nums = byBusDate[key];
        if (nums.length > 1) {
            return `Schedule ${nums[0]} and Schedule ${nums[1]} use the same bus on the same date. Each bus can only run one trip per calendar day — change the bus or the date.`;
        }
    }

    const byBus = {};
    for (let kb = 0; kb < rows.length; kb++) {
        const busSel = rows[kb].querySelector('.bus-select');
        const dateIn = rows[kb].querySelector('.date-input');
        const startIn = rows[kb].querySelector('.start-time-input');
        const endIn = rows[kb].querySelector('.end-time-input');
        if (!busSel || !dateIn || !startIn || !endIn) continue;
        const busId = busSel.value;
        const d = dateIn.value;
        const s = startIn.value;
        const e = endIn.value;
        const endsNext = rows[kb].querySelector('.ends-next-day-hidden')?.value === '1';
        const n = kb + 1;
        if (!busId || !d || !s || !e) continue;
        const ra = scheduleRowEpochRange(d, s, e, endsNext);
        if (ra.end <= ra.start) continue;
        if (!byBus[busId]) byBus[busId] = [];
        byBus[busId].push({ n, start: ra.start, end: ra.end });
    }
    for (const busId of Object.keys(byBus)) {
        const list = byBus[busId];
        for (let a = 0; a < list.length; a++) {
            for (let b = a + 1; b < list.length; b++) {
                if (list[a].start < list[b].end && list[a].end > list[b].start) {
                    return `Schedule ${list[a].n} and Schedule ${list[b].n} use the same bus with overlapping times. Choose a different bus or adjust the schedule.`;
                }
            }
        }
    }

    return null;
}

function scheduleWindowsOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && aEnd > bStart;
}

function readScheduleRowWindow(row) {
    const dateIn = row.querySelector('.date-input');
    const startIn = row.querySelector('.start-time-input');
    const endIn = row.querySelector('.end-time-input');
    const endsNext = row.querySelector('.ends-next-day-hidden')?.value === '1';
    if (!dateIn || !startIn || !endIn) return null;
    const d = dateIn.value;
    const s = startIn.value;
    const e = endIn.value;
    if (!d || !s || !e) return null;
    const r = scheduleRowEpochRange(d, s, e, endsNext);
    if (r.end <= r.start) return null;
    return { start: r.start, end: r.end };
}

/** Grey out buses already picked in another row when windows overlap (same form). */
function syncBulkBusSelectOptions() {
    const container = document.getElementById('schedulesContainer');
    if (!container) return;
    const rows = [...container.querySelectorAll('.schedule-row')];
    rows.forEach((row, i) => {
        const sel = row.querySelector('.bus-select');
        if (!sel) return;
        const selfWin = readScheduleRowWindow(row);
        [...sel.options].forEach((opt) => {
            if (!opt.value) {
                opt.disabled = false;
                return;
            }
            let disabled = false;
            for (let j = 0; j < rows.length; j++) {
                if (i === j) continue;
                const otherSel = rows[j].querySelector('.bus-select');
                if (!otherSel || otherSel.value !== opt.value) continue;
                const otherWin = readScheduleRowWindow(rows[j]);
                if (!selfWin || !otherWin) continue;
                if (scheduleWindowsOverlap(selfWin.start, selfWin.end, otherWin.start, otherWin.end)) {
                    disabled = true;
                    break;
                }
            }
            opt.disabled = disabled;
        });
    });
}

function toggleScheduleForm() {
    const formCard = document.getElementById('scheduleFormCard');
    const toggleBtn = document.getElementById('toggleScheduleFormBtn');
    
    if (formCard.style.display === 'none' || !formCard.style.display) {
        // Show form
        formCard.style.display = 'block';
        
        // Scroll to form
        formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function hideScheduleForm() {
    const formCard = document.getElementById('scheduleFormCard');
    
    formCard.style.display = 'none';
    
    // Reset form when hiding
    resetForm();
}

// Route details functionality
function updateRouteDetails() {
    const routeSelect = document.getElementById('route');
    const selectedRoute = routeSelect.options[routeSelect.selectedIndex];
    const routeDetails = document.getElementById('route-details');
    
    if (selectedRoute.value) {
        routeDetails.style.display = 'block';
        
        document.getElementById('route-path').textContent = 
            selectedRoute.dataset.start + ' → ' + selectedRoute.dataset.end;
        document.getElementById('regular-price').textContent = 
            parseFloat(selectedRoute.dataset.regular || 0).toFixed(2);
        document.getElementById('aircon-price').textContent = 
            parseFloat(selectedRoute.dataset.aircon || 0).toFixed(2);
        document.getElementById('duration').textContent = 
            selectedRoute.dataset.duration || '-';
        
        updateFare();
    } else {
        routeDetails.style.display = 'none';
    }
}

function updateFare() {
    const routeSelect = document.getElementById('route');
    const busSelect = document.getElementById('bus');
    const selectedRoute = routeSelect.options[routeSelect.selectedIndex];
    const selectedBus = busSelect.options[busSelect.selectedIndex];
    
    if (selectedRoute.value && selectedBus.value) {
        const busType = selectedBus.dataset.type;
        const isAircon = busType && (busType.toLowerCase().includes('air') || busType.toLowerCase().includes('ac'));
        
        const regularPrice = parseFloat(selectedRoute.dataset.regular || 0);
        const airconPrice = parseFloat(selectedRoute.dataset.aircon || 0);
        
        const finalFare = isAircon && airconPrice > 0 ? airconPrice : regularPrice;
        
        document.getElementById('bus-type').textContent = busType || '-';
        document.getElementById('final-fare').textContent = finalFare.toFixed(2);
        
        const fareCard = document.getElementById('final-fare').closest('.bg-success, .bg-info');
        if (fareCard) {
            if (isAircon) {
                fareCard.className = fareCard.className.replace('bg-success', 'bg-info');
            } else {
                fareCard.className = fareCard.className.replace('bg-info', 'bg-success');
            }
        }
    } else if (selectedRoute.value) {
        const regularPrice = parseFloat(selectedRoute.dataset.regular || 0);
        document.getElementById('bus-type').textContent = '-';
        document.getElementById('final-fare').textContent = regularPrice.toFixed(2);
    }
}

// Form reset functionality
function resetForm() {
    document.getElementById('scheduleForm').reset();
    document.getElementById('route-details').style.display = 'none';
    clearValidationErrors();
    
    // Reset submit button
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    if (submitBtn && submitText) {
        submitBtn.disabled = false;
        submitText.textContent = 'Create Schedule';
    }
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
        const input = document.getElementById(field) || document.getElementById(`edit_${field}`);
        const errorDiv = document.getElementById(`${field}_error`) || document.getElementById(`edit_${field}_error`);
        
        if (input && errorDiv) {
            input.classList.add('is-invalid');
            errorDiv.textContent = messages[0];
        }
    }
}

// Submit schedule form
function submitScheduleForm(e) {
    e.preventDefault();
    
    const form = document.getElementById('scheduleForm');
    const formData = new FormData(form);
    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    
    // Get CSRF token from meta tag
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    
    if (!csrfToken) {
        console.error('CSRF token not found!');
        showScheduleFeedbackModal('CSRF token missing. Please refresh the page.', 'error');
        return;
    }
    
    // Log form data being sent
    console.log('Form data being sent:');
    for (let pair of formData.entries()) {
        console.log(pair[0] + ': ' + pair[1]);
    }
    console.log('CSRF Token:', csrfToken);
    
    // Clear previous validation errors
    clearValidationErrors();
    
    if (submitBtn && submitText) {
        submitBtn.disabled = true;
        submitText.textContent = 'Creating...';
    }
    
    fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: {
            'X-CSRF-TOKEN': csrfToken,
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    const json = JSON.parse(text);
                    console.log('Error response:', json);
                    return Promise.reject(json);
                } catch (e) {
                    console.log('Raw error response:', text);
                    return Promise.reject({ message: 'Server error: ' + response.status });
                }
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Success response:', data);
        if (data.success) {
            showScheduleFeedbackModal(data.message, 'success', {
                onOk: () => {
                    resetForm();
                    location.reload();
                },
            });
        } else {
            throw new Error(data.message || 'Unknown error occurred');
        }
    })
    .catch(error => {
        console.error('Full error object:', error);
        
        if (error.errors) {
            console.log('Validation errors:', error.errors);
            showValidationErrors(error.errors);
            showScheduleFeedbackModal('Please check the form for errors', 'error');
        } else if (error.message) {
            console.log('Error message:', error.message);
            if (error.message.includes('already has a schedule')) {
                showDoubleBookingModal(error.message);
            } else {
                showScheduleFeedbackModal('Error creating schedule: ' + error.message, 'error');
            }
        } else {
            console.log('Unknown error:', error);
            showScheduleFeedbackModal('Error creating schedule: Unknown error', 'error');
        }
    })
    .finally(() => {
        if (submitBtn && submitText) {
            submitBtn.disabled = false;
            submitText.textContent = 'Create Schedule';
        }
    });
}

// Helper function to show modal
function showModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        // Check if Bootstrap is available
        if (typeof window.bootstrap !== 'undefined') {
            new window.bootstrap.Modal(modalElement).show();
        } else {
            // Fallback for when Bootstrap isn't loaded yet
            modalElement.classList.add('show');
            modalElement.style.display = 'block';
            modalElement.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            
            // Add backdrop
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            backdrop.id = 'modal-backdrop';
            document.body.appendChild(backdrop);
        }
    }
}

// Helper function to hide modal
function hideModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        // Check if Bootstrap is available
        if (typeof window.bootstrap !== 'undefined') {
            const modalInstance = window.bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
        } else {
            // Fallback for when Bootstrap isn't loaded yet
            modalElement.classList.remove('show');
            modalElement.style.display = 'none';
            modalElement.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
            
            // Remove backdrop
            const backdrop = document.getElementById('modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
        }
    }
}

// Modal functions for view and edit
function viewSchedule(id) {
    fetch(`/schedules/${id}`) 
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
                        <p><strong>Date:</strong> ${formatDateToDMY(data.date)}</p>
                        <p><strong>Time:</strong> ${data.start_time} - ${data.end_time}</p>
                        <p><strong>Status:</strong> <span class="badge bg-primary">${data.status}</span></p>
                    </div>
                </div>
                ${data.notes ? `<div class="mt-3"><strong>Notes:</strong><br>${data.notes}</div>` : ''}
            `;
            document.getElementById('viewScheduleContent').innerHTML = content;
            showModal('viewScheduleModal');
        })
        .catch(error => {
            console.error('Error:', error);
            showScheduleFeedbackModal('Failed to load schedule details', 'error');
        });
}

function normalizeTimeForInput(raw) {
    if (raw == null || raw === '') return '';
    const s = String(raw);
    return s.length >= 5 ? s.slice(0, 5) : s;
}

function editSchedule(id) {
    fetch(`/schedules/${id}`) 
        .then(response => response.json())
        .then(data => {
            document.getElementById('edit_schedule_id').value = data.id;
            document.getElementById('edit_route_id').value = data.route_id;
            document.getElementById('edit_bus_id').value = data.bus_id;
            document.getElementById('edit_driver_id').value = data.driver_id;
            document.getElementById('edit_status').value = data.status;
            document.getElementById('edit_date').value = typeof data.date === 'string' ? data.date.split('T')[0] : data.date;
            document.getElementById('edit_start_time').value = normalizeTimeForInput(data.start_time);
            document.getElementById('edit_end_time').value = normalizeTimeForInput(data.end_time);
            const enx = document.getElementById('edit_ends_next_day');
            if (enx) {
                enx.checked = !!(data.ends_next_day === true || data.ends_next_day === 1 || data.ends_next_day === '1');
            }
            document.getElementById('edit_notes').value = data.notes || '';
            
            document.getElementById('editScheduleForm').action = `/schedules/${id}`;
            showModal('editScheduleModal');
        })
        .catch(error => {
            console.error('Error:', error);
            showScheduleFeedbackModal('Failed to load schedule details', 'error');
        });
}

function saveScheduleChanges() {
    const form = document.getElementById('editScheduleForm');
    const formData = new FormData(form);
    const saveBtn = document.getElementById('saveScheduleBtn');
    const saveText = document.getElementById('saveScheduleText');
    const originalText = saveText.textContent;
    
    // Clear previous validation errors
    clearValidationErrors();
    
    saveBtn.disabled = true;
    saveText.textContent = 'Saving...';
    
    fetch(form.action, {
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
            hideModal('editScheduleModal');
            showScheduleFeedbackModal(data.message, 'success', {
                onOk: () => location.reload(),
            });
        } else {
            throw new Error(data.message || 'Unknown error occurred');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        
        if (error.errors) {
            showValidationErrors(error.errors);
            showScheduleFeedbackModal('Please check the form for errors', 'error');
        } else if (error.message && error.message.includes('already has a schedule')) {
            showDoubleBookingModal(error.message);
        } else {
            showScheduleFeedbackModal('Error updating schedule: ' + (error.message || 'Unknown error'), 'error');
        }
    })
    .finally(() => {
        saveBtn.disabled = false;
        saveText.textContent = originalText;
    });
}

// Clear filters functionality
function clearFilters() {
    // Reset all filter dropdowns and inputs
    const filterDriver = document.getElementById('filterDriver');
    const filterRoute = document.getElementById('filterRoute');
    const filterStatus = document.getElementById('filterStatus');
    const filterDate = document.getElementById('filterDate');
    
    if (filterDriver) filterDriver.value = '';
    if (filterRoute) filterRoute.value = '';
    if (filterStatus) filterStatus.value = '';
    if (filterDate) filterDate.value = '';
    
    // Navigate to clear URL
    window.location.href = window.location.pathname;
}

// Date format helper function
function formatDateToDMY(dateString) {
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

function validateScheduleForm() {
    const route = document.getElementById('route').value;
    const driver = document.getElementById('driver').value;
    const bus = document.getElementById('bus').value;
    const startTime = document.getElementById('start_time').value;
    const endTime = document.getElementById('end_time').value;
    const date = document.getElementById('date').value;
    
    if (!route || !driver || !bus || !startTime || !endTime || !date) {
        return 'Please fill in all required fields.';
    }
    
    if (endTime <= startTime) {
        return 'End time must be after start time.';
    }
    
    // Check if the selected date is in the past
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        return 'Cannot schedule for past dates.';
    }
    
    return null;
}

// Custom placeholder for date input
function setupDatePlaceholder() {
    const filterDateInput = document.getElementById('filterDate');
    if (filterDateInput) {
        const placeholder = filterDateInput.getAttribute('data-placeholder');
        
        // Set initial appearance
        if (!filterDateInput.value) {
            filterDateInput.setAttribute('data-date', placeholder);
            filterDateInput.style.color = '#6c757d'; // Bootstrap text-muted color
        }
        
        // Handle focus - show calendar
        filterDateInput.addEventListener('focus', function() {
            this.style.color = '#212529'; // Normal text color
            this.removeAttribute('data-date');
        });
        
        // Handle blur - restore placeholder if empty
        filterDateInput.addEventListener('blur', function() {
            if (!this.value) {
                this.setAttribute('data-date', placeholder);
                this.style.color = '#6c757d';
            }
        });
        
        // Handle change - keep normal color when date is selected
        filterDateInput.addEventListener('change', function() {
            if (this.value) {
                this.style.color = '#212529';
                this.removeAttribute('data-date');
            }
        });
    }
}

// Make functions globally available
window.updateRouteDetails = updateRouteDetails;
window.updateFare = updateFare;
window.resetForm = resetForm;
window.viewSchedule = viewSchedule;
window.editSchedule = editSchedule;
window.saveScheduleChanges = saveScheduleChanges;
window.clearFilters = clearFilters;
window.showModal = showModal;
window.hideModal = hideModal;
window.formatDateToDMY = formatDateToDMY;
window.toggleScheduleForm = toggleScheduleForm;
window.hideScheduleForm = hideScheduleForm;
window.showDoubleBookingModal = showDoubleBookingModal;

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Route and bus change listeners
    const routeSelect = document.getElementById('route');
    const busSelect = document.getElementById('bus');
    
    if (routeSelect) {
        routeSelect.addEventListener('change', updateRouteDetails);
    }
    
    if (busSelect) {
        busSelect.addEventListener('change', updateFare);
    }

    let scheduleToDelete = null;

    function deleteSchedule(id) {
        scheduleToDelete = id;
        showModal('deleteScheduleModal');
    }

    window.deleteSchedule = deleteSchedule;

    document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
        if (!scheduleToDelete) return;
        fetch(`/schedules/${scheduleToDelete}`, {
            method: 'DELETE',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                'Accept': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            } else {
                showScheduleFeedbackModal(data.message || 'Could not delete schedule', 'error');
            }
        })
        .catch(error => {
            showScheduleFeedbackModal('Error deleting schedule', 'error');
        })
        .finally(() => {
            scheduleToDelete = null;
            hideModal('deleteScheduleModal');
        });
    });

    document.getElementById('cancelDeleteBtn').addEventListener('click', function() {
        scheduleToDelete = null;
        hideModal('deleteScheduleModal');
    });
    
    // Reset form button
    const resetFormBtn = document.getElementById('resetFormBtn');
    if (resetFormBtn) {
        resetFormBtn.addEventListener('click', function(e) {
            e.preventDefault();
            resetForm();
        });
    }
    
    // Form submission
    const scheduleForm = document.getElementById('scheduleForm');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const error = validateScheduleForm();
            if (error) {
                showScheduleFeedbackModal(error, 'error');
                return;
            }
            submitScheduleForm(e);
        });
    }

    // Toggle schedule form button (only shows the form)
    const toggleScheduleFormBtn = document.getElementById('toggleScheduleFormBtn');
    if (toggleScheduleFormBtn) {
        toggleScheduleFormBtn.addEventListener('click', toggleScheduleForm);
    }
    
    // Hide schedule form button (X button)
    const hideScheduleFormBtn = document.getElementById('hideScheduleFormBtn');
    if (hideScheduleFormBtn) {
        hideScheduleFormBtn.addEventListener('click', hideScheduleForm);
    }
    
    // Save schedule changes button
    const saveScheduleBtn = document.getElementById('saveScheduleBtn');
    if (saveScheduleBtn) {
        saveScheduleBtn.addEventListener('click', saveScheduleChanges);
    }
    
    // Clear filters button
    const clearFiltersBtn = document.querySelector('button[onclick="clearFilters()"]');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function(e) {
            e.preventDefault();
            clearFilters();
        });
    }
    
    // Modal close buttons
    const modalCloseButtons = document.querySelectorAll('[data-bs-dismiss="modal"]');
    modalCloseButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = button.closest('.modal');
            if (modal) {
                hideModal(modal.id);
            }
        });
    });
    
    // Initialize default date
    const dateInput = document.getElementById('date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Setup date placeholder for filter
    setupDatePlaceholder();
    
    // Check Bootstrap availability
    const checkBootstrap = () => {
        if (typeof window.bootstrap !== 'undefined') {
            console.log('Bootstrap is available');
        } else {
            console.log('Bootstrap not yet available, using fallback modal functions');
        }
    };
    
    checkBootstrap();
    setTimeout(checkBootstrap, 100);

    // Auto-refresh when drivers accept/decline/start/complete (checksum of filtered list changes)
    if (window.location.pathname.includes('/panel/schedule')) {
        let lastChecksum = null;
        setInterval(async () => {
            try {
                const u = new URL(window.location.href);
                const res = await fetch('/panel/schedule/checksum' + u.search, {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'same-origin',
                });
                if (!res.ok) return;
                const data = await res.json();
                if (!data.success || typeof data.checksum !== 'string') return;
                if (lastChecksum !== null && data.checksum !== lastChecksum) {
                    window.location.reload();
                    return;
                }
                lastChecksum = data.checksum;
            } catch (_) {
                /* offline / transient */
            }
        }, 8000);
    }
});

// =============
// BULK SCHEDULE ASSIGNMENT LOGIC
// =============

let currentDriverId = null;
let currentDriverName = '';

// Handle driver selection
document.getElementById('driverSelectionForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const driverSelect = document.getElementById('driver_select');
    const driverId = driverSelect.value;
    const driverName = driverSelect.options[driverSelect.selectedIndex].text;

    if (!driverId) {
        showScheduleFeedbackModal('Please select a driver.', 'error');
        return;
    }

    currentDriverId = driverId;
    currentDriverName = driverName.split(' (')[0];

    document.getElementById('selectedDriverName').textContent = currentDriverName;
    const scheduleSection = document.getElementById('scheduleCreationSection');
    scheduleSection.style.display = 'block';
    
    this.style.display = 'none';

    // Clear any existing rows first
    document.getElementById('schedulesContainer').innerHTML = '';

    // Add the first empty schedule row
    addScheduleRow();

    scheduleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Change driver button
document.getElementById('changeDriverBtn')?.addEventListener('click', function() {
    document.getElementById('scheduleCreationSection').style.display = 'none';
    
    const driverForm = document.getElementById('driverSelectionForm');
    driverForm.style.display = 'block';
    
    document.getElementById('schedulesContainer').innerHTML = '';
    
    document.getElementById('driver_select').value = '';
    currentDriverId = null;
    currentDriverName = '';
});

//   Add Schedule Row button listener
document.getElementById('addScheduleRowBtn')?.addEventListener('click', function() {
    addScheduleRow();
});

//   Reset schedules form button listener
document.getElementById('resetSchedulesFormBtn')?.addEventListener('click', function() {
    document.getElementById('schedulesContainer').innerHTML = '';
    addScheduleRow();
    showScheduleFeedbackModal('Form reset. Add new schedules.', 'info');
});

//   Save all schedules button listener
document.getElementById('saveAllSchedulesBtn')?.addEventListener('click', function() {
    saveAllSchedules();
});

function addScheduleRow() {
    const container = document.getElementById('schedulesContainer');
    const template = document.getElementById('scheduleRowTemplate');
    
    if (!template) {
        console.error('Schedule row template not found');
        showScheduleFeedbackModal('Error: Template not found', 'error');
        return;
    }
    
    // Clone the template content
    const templateContent = template.querySelector('.schedule-row');
    if (!templateContent) {
        console.error('Schedule row element not found in template');
        return;
    }
    
    const newRow = templateContent.cloneNode(true);
    
    // Set the driver_id for this row
    const driverInput = newRow.querySelector('.driver_id_input');
    if (driverInput) {
        driverInput.value = currentDriverId;
    }

    // Add the row to container
    container.appendChild(newRow);

    const dateInput = newRow.querySelector('.date-input');
    if (dateInput) {
        const allRowsNow = container.querySelectorAll('.schedule-row');
        if (allRowsNow.length > 1) {
            const prevRow = allRowsNow[allRowsNow.length - 2];
            const prevDateEl = prevRow.querySelector('.date-input');
            if (prevDateEl && prevDateEl.value) {
                const d = new Date(`${prevDateEl.value}T12:00:00`);
                d.setDate(d.getDate() + 1);
                dateInput.value = d.toISOString().slice(0, 10);
            }
        }
        dateInput.addEventListener('change', () => {
            applyScheduleRowConstraints(newRow);
            syncBulkBusSelectOptions();
        });
    }

    // Get elements from the newly added row
    const routeSelect = newRow.querySelector('.route-select');
    const startTimeInput = newRow.querySelector('.start-time-input');
    const endTimeInput = newRow.querySelector('.end-time-input');
    const busSelect = newRow.querySelector('.bus-select');
    const removeBtn = newRow.querySelector('.remove-schedule-row');

    //   Auto-calculate end time when start time or route changes
    if (routeSelect && startTimeInput && endTimeInput) {
        routeSelect.addEventListener('change', () => {
            calculateEndTime(routeSelect, startTimeInput, endTimeInput);
            updateFareInputs(newRow, routeSelect, busSelect);
            syncBulkBusSelectOptions();
        });
        
        startTimeInput.addEventListener('change', () => {
            applyScheduleRowConstraints(newRow);
            calculateEndTime(routeSelect, startTimeInput, endTimeInput);
            syncBulkBusSelectOptions();
        });
    }

    applyScheduleRowConstraints(newRow);

    //   Update fare when bus type changes
    if (busSelect && routeSelect) {
        busSelect.addEventListener('change', () => {
            updateFareInputs(newRow, routeSelect, busSelect);
            syncBulkBusSelectOptions();
        });
    }

    //   Add remove button functionality
    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            const rows = container.querySelectorAll('.schedule-row');
            if (rows.length > 1) {
                newRow.remove();
                syncBulkBusSelectOptions();
            } else {
                showScheduleFeedbackModal('At least one schedule row is required', 'warning');
            }
        });
    }

    syncBulkBusSelectOptions();
}

//   Function to update hidden fare inputs
function updateFareInputs(row, routeSelect, busSelect) {
    if (!routeSelect.value) {
        // Clear fare display if no route selected
        const fareDisplay = row.querySelector('.fare-display');
        if (fareDisplay) fareDisplay.textContent = '₱0.00';
        return;
    }
    
    const selectedRoute = routeSelect.options[routeSelect.selectedIndex];
    const selectedBus = busSelect && busSelect.value ? busSelect.options[busSelect.selectedIndex] : null;
    
    //   Get fare from route (use route_fare as primary, fallback to regular_price)
    const routeFare = parseFloat(selectedRoute.dataset.routeFare) || 0;
    const regularFare = parseFloat(selectedRoute.dataset.regularFare) || routeFare;
    const airconFare = parseFloat(selectedRoute.dataset.airconFare) || routeFare;
    
    console.log('Route fare data:', {
        routeFare,
        regularFare,
        airconFare,
        dataset: selectedRoute.dataset
    });
    
    //   Determine which fare to use based on bus type
    let finalFare = routeFare; // Default to route fare
    
    if (selectedBus) {
        const busType = selectedBus.dataset.type;
        const isAircon = busType && busType.toLowerCase().includes('air');
        finalFare = isAircon ? airconFare : regularFare;
    }
    
    //   Update hidden inputs
    const fareRegularInput = row.querySelector('.fare-regular-input');
    const fareAirconInput = row.querySelector('.fare-aircon-input');
    
    if (fareRegularInput) fareRegularInput.value = regularFare.toFixed(2);
    if (fareAirconInput) fareAirconInput.value = airconFare.toFixed(2);
    
    //   Update visible fare display
    const fareDisplay = row.querySelector('.fare-display');
    if (fareDisplay) {
        fareDisplay.textContent = `₱${finalFare.toFixed(2)}`;
    }
    
    console.log('Updated fares:', {
        regularFare,
        airconFare,
        finalFare
    });
}

// Function to calculate end time
function calculateEndTime(routeSelect, startTimeInput, endTimeInput) {
    const routeId = routeSelect.value;
    const startTime = startTimeInput.value;
    const row = endTimeInput.closest('.schedule-row');
    const hiddenNext = row ? row.querySelector('.ends-next-day-hidden') : null;

    if (!routeId || !startTime) {
        endTimeInput.value = '';
        if (hiddenNext) hiddenNext.value = '0';
        return;
    }

    const duration = parseInt(routeSelect.options[routeSelect.selectedIndex].dataset.duration) || 0;
    if (duration <= 0) {
        endTimeInput.value = '';
        if (hiddenNext) hiddenNext.value = '0';
        return;
    }

    const [startHours, startMinutes] = startTime.split(':').map(Number);
    let totalMinutes = startHours * 60 + startMinutes + duration;

    const isNextDay = totalMinutes >= 24 * 60;
    if (isNextDay) {
        totalMinutes = totalMinutes % (24 * 60);
    }

    const endHours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const endMinutes = String(totalMinutes % 60).padStart(2, '0');
    endTimeInput.value = `${endHours}:${endMinutes}`;
    if (hiddenNext) {
        hiddenNext.value = isNextDay ? '1' : '0';
    }
}

// Function to save all schedules
async function saveAllSchedules() {
    const container = document.getElementById('schedulesContainer');
    const rows = container.querySelectorAll('.schedule-row');
    
    if (rows.length === 0) {
        showScheduleFeedbackModal('Please add at least one schedule.', 'error');
        return;
    }

    const preCheck = validateBulkScheduleRowsBeforeSave();
    if (preCheck) {
        showScheduleFeedbackModal(preCheck, 'error');
        return;
    }

    //   Validate all rows first
    let isValid = true;
    const schedules = [];
    
    rows.forEach(row => {
        const scheduleData = {};
        const inputs = row.querySelectorAll('input[name], select[name]');
        
        inputs.forEach(input => {
            const match = input.name.match(/schedules\[\]\[(\w+)\]/);
            if (match) {
                scheduleData[match[1]] = input.value;
                
                //   Basic validation
                if (input.hasAttribute('required') && !input.value) {
                    isValid = false;
                    input.classList.add('is-invalid');
                } else {
                    input.classList.remove('is-invalid');
                }
            }
        });
        
        schedules.push(scheduleData);
    });

    if (!isValid) {
        showScheduleFeedbackModal('Please fill in all required fields.', 'error');
        return;
    }

    // Show loading state
    const saveBtn = document.getElementById('saveAllSchedulesBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';

    try {
        const response = await fetch('/schedules/bulk', {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ schedules })
        });

        //   Updated error handling
        if (!response.ok) {
            const errorData = await response.json();
            throw errorData; // Throw the error data to be caught below
        }

        const result = await response.json();
        
        if (result.success) {
            showScheduleFeedbackModal(result.message || 'Schedules saved.', 'success', {
                onOk: () => {
                    const card = document.getElementById('scheduleFormCard');
                    if (card) card.style.display = 'none';
                    location.reload();
                },
            });
        } else {
            let msg = result.message || 'Failed to save schedules.';
            if (result.errors && typeof result.errors === 'object') {
                const parts = [];
                Object.values(result.errors).forEach((arr) => {
                    (Array.isArray(arr) ? arr : [arr]).forEach((m) => parts.push(m));
                });
                if (parts.length) msg = parts.join('\n');
            }
            showScheduleFeedbackModal(msg, 'error');
        }
    } catch (error) {
        console.error('Error saving schedules:', error);

        let msg =
            typeof error === 'string'
                ? error
                : (error?.message || 'An unexpected error occurred while saving schedules.');
        if (error && typeof error === 'object' && error.errors && typeof error.errors === 'object') {
            const parts = [];
            Object.values(error.errors).forEach((arr) => {
                (Array.isArray(arr) ? arr : [arr]).forEach((m) => parts.push(m));
            });
            if (parts.length) msg = parts.join('\n');
        }

        if (msg.includes('already has a schedule')) {
            showDoubleBookingModal(msg);
        } else {
            showScheduleFeedbackModal(msg, 'error');
        }
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}
