let currentSpace = null;
let countdownTimer = null;
let remainingSeconds = 0;
let tooltipSticky = false;
let isEditMode = false;
let selectedSpaceElement = null;
let expirationCheckInterval = null;
let tooltipCountdownTimer = null;
let currentHistoryPage = 1; // Track current history page for smooth updates
let originalSpaceRouteName = null; // Store original space route name to prevent overwriting
const occupiedSpaces = new Map();
const spaceExpirationTimes = new Map(); // Track expiration times for each space
const historyRecords = [];
const spaceMapping = {}; // Map to store element references

document.addEventListener('DOMContentLoaded', () => {
    const tooltip = document.getElementById('tooltip');

    // Step 1: Get all green bays (.cls-9)
    const bays = Array.from(document.querySelectorAll('.cls-9'));
    if (!bays.length) {
        console.error('❌ No SVG elements found with class .cls-9');
        return;
    }

    // Step 2: Get SVG container
    const svgEl = document.querySelector('svg');
    if (!svgEl) {
        console.error('❌ SVG element not found');
        return;
    }
    const svgRect = svgEl.getBoundingClientRect();
    const svgWidth = svgRect.width;

    // Step 3-4: Smart clustering - find TOP row first, then LEFT/RIGHT
    const bayEntries = bays.map(el => {
        const bbox = el.getBBox();
        return {
            el,
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height
        };
    }).sort((a, b) => a.x - b.x);

    // Find TOP spaces by grouping elements with similar Y values
    const yGroups = {};
    const yTolerance = 40; // Tolerance for grouping by Y

    bayEntries.forEach(entry => {
        let foundGroup = false;
        for (let yKey in yGroups) {
            if (Math.abs(entry.y - parseFloat(yKey)) < yTolerance) {
                yGroups[yKey].push(entry);
                foundGroup = true;
                break;
            }
        }
        if (!foundGroup) {
            yGroups[entry.y] = [entry];
        }
    });

    // The group with the most elements is TOP (should be 14)
    let topBays = [];
    let maxGroupSize = 0;
    for (let yKey in yGroups) {
        if (yGroups[yKey].length > maxGroupSize) {
            maxGroupSize = yGroups[yKey].length;
            topBays = yGroups[yKey];
        }
    }
    topBays.sort((a, b) => a.x - b.x);

    // Remaining elements: split into LEFT and RIGHT by X
    const remaining = bayEntries.filter(e => !topBays.includes(e));
    const minX = Math.min(...remaining.map(e => e.x));
    const maxX = Math.max(...remaining.map(e => e.x));
    const midX = minX + (maxX - minX) / 2;

    const leftBays = remaining.filter(e => e.x <= midX).sort((a, b) => a.y - b.y);
    const rightBays = remaining.filter(e => e.x > midX).sort((a, b) => a.y - b.y);

    // Assign IDs
    const idMap = new Map();
    let idx = 1;
    leftBays.forEach(entry => idMap.set(entry.el, `L${idx++}`));
    idx = 1;
    topBays.forEach(entry => idMap.set(entry.el, `T${idx++}`));
    idx = 1;
    rightBays.forEach(entry => idMap.set(entry.el, `R${idx++}`));

    console.log(`✓ Clustering: LEFT=${leftBays.length}, TOP=${topBays.length}, RIGHT=${rightBays.length}`);

    // Step 5: Fetch space data
    fetch('/api/terminal/spaces')
        .then(res => res.json())
        .then(spacesData => {
            const spaceMap = new Map();
            spacesData.forEach(space => spaceMap.set(space.space_id, space));

            // Apply data to bays
            bays.forEach(el => {
                const spaceId = idMap.get(el);
                if (!spaceId) return;

                const space = spaceMap.get(spaceId);
                if (space) {
                    el.setAttribute('data-space-id', spaceId);
                    el.setAttribute('data-route', space.route_name || spaceId);
                    el.setAttribute('data-accommodation-type', space.accommodation_type || '');
                    el.setAttribute('data-status', space.status || 'available');

                    if (space.is_occupied) {
                        el.setAttribute('fill', '#dc3545');
                        el.classList.remove('cls-9');
                        el.classList.add('occupied-bay');
                        // Store expiration time for occupied spaces
                        if (space.available_at) {
                            spaceExpirationTimes.set(spaceId, new Date(space.available_at).getTime());
                        }
                    } else {
                        el.setAttribute('fill', '#35d335');
                        el.classList.add('cls-9');
                        el.classList.remove('occupied-bay');
                    }
                } else {
                    el.setAttribute('data-space-id', spaceId);
                    el.setAttribute('data-route', spaceId);
                    el.setAttribute('data-accommodation-type', '');
                    el.setAttribute('data-status', 'available');
                    el.setAttribute('fill', '#35d335');
                    el.classList.add('cls-9');
                }
            });

            // Step 6: Attach event listeners
            bays.forEach(el => {
                const spaceId = idMap.get(el);
                if (!spaceId) return;

                el.addEventListener('mouseenter', function(e) {
                    if (tooltipSticky) return;

                    currentSpace = el;
                    updateTooltip(el);

                    const spaceId = idMap.get(el);
                    const pos = getTooltipPosition(spaceId, el);  // Use the function!
                    
                    tooltip.style.left = pos.left + 'px';
                    tooltip.style.top = pos.top + 'px';
                    tooltip.className = 'tooltip-bubble ' + pos.class;
                    tooltip.style.display = 'block';
                    el.classList.add('space-bay-hovered');
                });

                el.addEventListener('mouseleave', () => {
                    if (!tooltipSticky) {
                        tooltip.style.display = 'none';
                        if (currentSpace) {
                            currentSpace.classList.remove('space-bay-hovered');
                        }
                        currentSpace = null;
                    }
                });

                el.addEventListener('click', function(e) {
                    e.stopPropagation();
                    tooltipSticky = true;
                    currentSpace = el;

                    const spaceId = idMap.get(el);
                    const pos = getTooltipPosition(spaceId, el);  // Use the function!
                    
                    tooltip.style.left = pos.left + 'px';
                    tooltip.style.top = pos.top + 'px';
                    tooltip.className = 'tooltip-bubble ' + pos.class;
                    tooltip.style.display = 'block';
                });
            });

            // Tooltip sticky behavior
            tooltip.addEventListener('mouseenter', () => {
                tooltipSticky = true;
            });
            tooltip.addEventListener('mouseleave', () => {
                tooltipSticky = false;
                tooltip.style.display = 'none';
                if (currentSpace) {
                    currentSpace.classList.remove('space-bay-hovered');
                    currentSpace = null;
                }
            });

            // Close on outside click
            document.addEventListener('click', (e) => {
                if (tooltipSticky &&
                    !tooltip.contains(e.target) &&
                    !Array.from(bays).some(bay => bay.contains(e.target))) {
                    tooltipSticky = false;
                    tooltip.style.display = 'none';
                    if (currentSpace) {
                        currentSpace.classList.remove('space-bay-hovered');
                        currentSpace = null;
                    }
                }
            });

            // Load history
            expirationCheckInterval = setInterval(checkAndReleaseExpiredSpaces, 10000);
            console.log('✓ Started expiration check interval (every 10 seconds)');
            initializeDateFilter();
            loadHistoryFromDatabase();
        })
        .catch(err => {
            console.error('❌ Failed to load spaces:', err);
        });
});

function updateTooltip(spaceElement) {
    const spaceId = spaceElement.getAttribute('data-space-id');
    const route = spaceElement.getAttribute('data-route') || spaceId;

    if (!spaceId) {
        console.error('Space ID is null');
        return;
    }

    document.getElementById('tooltipRoute').textContent = route || spaceId;

    const statusEl = document.getElementById('tooltipStatus');
    const timeEl = document.getElementById('tooltipTime');
    const actionsEl = document.getElementById('tooltipActions');

    if (spaceElement.classList.contains('occupied-bay')) {
        statusEl.textContent = 'Occupied';
        statusEl.classList.add('occupied');
        timeEl.style.display = 'inline';
        
        // Clear any existing countdown timer for tooltip
        if (tooltipCountdownTimer) {
            clearInterval(tooltipCountdownTimer);
            tooltipCountdownTimer = null;
        }
        
        // Start countdown timer for tooltip
        startTooltipCountdown(spaceId, timeEl);
        
        // ADD COMPLETE button here
        actionsEl.innerHTML = `
            <button class="tooltip-btn" onclick="editSpaceMode(event); event.stopPropagation();">EDIT</button>
            <button class="tooltip-btn" style="background: #28a745; color: white; border-color: #28a745;" onclick="completeSpaceFromTooltip(event); event.stopPropagation();">COMPLETE</button>
            <button class="tooltip-btn cancel-btn" onclick="cancelSpaceOccupancy(event); event.stopPropagation();">CANCEL</button>
        `;
    } else {
        statusEl.textContent = 'Available';
        statusEl.classList.remove('occupied');
        timeEl.style.display = 'none';
        
        // Clear countdown when switching to available space
        if (tooltipCountdownTimer) {
            clearInterval(tooltipCountdownTimer);
            tooltipCountdownTimer = null;
        }
        
        actionsEl.innerHTML = `
            <button class="tooltip-btn" onclick="editSpaceMode(event); event.stopPropagation();">EDIT</button>
            <button class="tooltip-btn" onclick="occupySpace(event); event.stopPropagation();">OCCUPY</button>
        `;
    }
}

function startTooltipCountdown(spaceId, timeEl) {
    // Fetch current space data to get expiration time
    fetch('/api/terminal/spaces')
        .then(res => res.json())
        .then(spacesData => {
            const space = spacesData.find(s => s.space_id === spaceId);
            if (space && (space.expiration_time || space.available_at)) {
                const expirationTime = new Date(space.expiration_time || space.available_at).getTime();
                spaceExpirationTimes.set(spaceId, expirationTime);
                updateTooltipTimer(spaceId, timeEl);
            } else {
                timeEl.textContent = 'N/A';
            }
        })
        .catch(err => {
            console.error('Error fetching space data:', err);
            timeEl.textContent = 'N/A';
        });
}

function updateTooltipTimer(spaceId, timeEl) {
    // Clear existing timer
    if (tooltipCountdownTimer) {
        clearInterval(tooltipCountdownTimer);
    }
    
    const updateDisplay = () => {
        const expirationTime = spaceExpirationTimes.get(spaceId);
        if (!expirationTime) {
            timeEl.textContent = 'N/A';
            return;
        }
        
        const now = Date.now();
        const diff = expirationTime - now;
        
        if (diff <= 0) {
            timeEl.textContent = '00:00';
            clearInterval(tooltipCountdownTimer);
            tooltipCountdownTimer = null;
        } else {
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            timeEl.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        }
    };
    
    // Update immediately
    updateDisplay();
    
    // Update every second
    tooltipCountdownTimer = setInterval(updateDisplay, 1000);
}

function completeSpaceFromTooltip(e) {
    if (e) e.preventDefault();
    if (!currentSpace) {
        showSpaceAlert('No space selected');
        return;
    }

    const spaceId = currentSpace.getAttribute('data-space-id');
    const spaceElement = currentSpace;
    if (!spaceId) return;

    // Show modal for notes
    showReasonModal('Complete Space', 'Complete', function(notes) {
        fetch('/api/terminal/release', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({ 
                space_id: spaceId,
                notes: notes || 'Manually released'
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSpaceAlert('✓ Space marked as COMPLETE');
                if (spaceElement) {
                    spaceElement.classList.remove('occupied-bay');
                    spaceElement.setAttribute('fill', '#35d335');
                    spaceElement.classList.add('cls-9');
                }
                occupiedSpaces.delete(spaceId);
                spaceExpirationTimes.delete(spaceId);
                loadHistoryFromDatabase(currentHistoryPage);
                closeTooltip();
            } else {
                showSpaceAlert('Error: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Complete error:', error);
            showSpaceAlert('Error completing occupancy: ' + error.message);
        });
    });
}

document.addEventListener('click', (e) => {
    if (tooltipSticky) {
        const tooltip = document.getElementById('tooltip');
        if (!tooltip.contains(e.target) && !e.target.closest('.cls-9')) {
            closeTooltip();
        }
    }
}, true);

function closeTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltipSticky = false;
    tooltip.style.display = 'none';
    if (tooltipCountdownTimer) {
        clearInterval(tooltipCountdownTimer);
        tooltipCountdownTimer = null;
    }
    if (currentSpace) {
        currentSpace.classList.remove('space-bay-hovered');
    }
    currentSpace = null;
}

function getTooltipPosition(spaceId, element) {
    const rect = element.getBoundingClientRect();
    const tooltipWidth = 220;
    const tooltipHeight = 140;
    const padding = 20;
    
    let position = { left: 0, top: 0, class: '' };
    
    if (spaceId.startsWith('T')) {
        position.left = rect.left + rect.width / 2 - tooltipWidth / 2;
        position.top = rect.bottom + padding;
        position.class = '';
    } 
    else if (spaceId.startsWith('L')) {
        position.left = rect.right + padding;
        position.top = rect.top + rect.height / 2 - tooltipHeight / 2;
        position.class = 'side-right';
    } 
    else if (spaceId.startsWith('R')) {
        position.left = rect.left - tooltipWidth - padding;
        position.top = rect.top + rect.height / 2 - tooltipHeight / 2;
        position.class = 'side-left';
    } 
    else {
        position.left = rect.left + rect.width / 2 - tooltipWidth / 2;
        position.top = rect.bottom + padding;
        position.class = '';
    }
    
    return position;
}

function loadSpacesFromDatabase() {
    fetch('/api/terminal/drivers')
        .then(response => response.json())
        .catch(error => console.log('Space loading - will load from history'));
}

function fillCompanyOperator() {
    const driverSelect = document.getElementById('panelDriver');
    const driverId = driverSelect.value;
    const selectedDriver = driverSelect.options[driverSelect.selectedIndex];
    const driverOperatorId = selectedDriver?.dataset.operatorId || '';
    const driverCompany = selectedDriver?.dataset.company || '';

    // Driver selected, now populate operator dropdown and fetch driver's routes
    if (driverId) {
        // Fetch operators
        fetch(`/api/terminal/drivers`)
            .then(response => response.json())
            .then(data => {
                const operatorSelect = document.getElementById('panelOperator');
                operatorSelect.innerHTML = '<option value="">-- Select Operator --</option>';
                const apiDriver = (data.drivers || []).find(driver => String(driver.id) === String(driverId));
                const apiOperator = apiDriver?.user || null;
                const resolvedOperatorId = driverOperatorId || (apiOperator?.id ? String(apiOperator.id) : '');
                
                // Populate with all available operators
                data.operators.forEach(op => {
                    const option = document.createElement('option');
                    option.value = op.id;
                    option.dataset.company = op.company_name;
                    option.textContent = op.name;
                    operatorSelect.appendChild(option);
                });

                if (resolvedOperatorId && !Array.from(operatorSelect.options).some(option => option.value === resolvedOperatorId)) {
                    const option = document.createElement('option');
                    option.value = resolvedOperatorId;
                    option.dataset.company = apiOperator?.company_name || driverCompany || '';
                    option.textContent = apiOperator?.name || 'Assigned operator';
                    operatorSelect.appendChild(option);
                }

                if (resolvedOperatorId) {
                    operatorSelect.value = resolvedOperatorId;
                }

                const selectedOperator = operatorSelect.options[operatorSelect.selectedIndex];
                document.getElementById('panelCompany').value = selectedOperator?.dataset.company || apiOperator?.company_name || driverCompany || '';
            })
            .catch(error => console.error('Error fetching operators:', error));

        // Fetch driver's assigned routes
        fetch(`/api/terminal/driver-routes/${driverId}`)
            .then(response => response.json())
            .then(data => {
                // PRESERVE the original space route name instead of overwriting it
                // Only update if no original route name was set
                if (data.success && data.routes.length > 0) {
                    const selectedRoute = data.routes[0];
                    if (!originalSpaceRouteName) {
                        document.getElementById('panelRouteName').value = selectedRoute.name;
                    }
                    window.selectedDriverRoute = selectedRoute.name;
                } else {
                    if (!originalSpaceRouteName) {
                        document.getElementById('panelRouteName').value = '';
                    }
                    window.selectedDriverRoute = null;
                }
            })
            .catch(error => {
                console.error('Error fetching driver routes:', error);
                if (!originalSpaceRouteName) {
                    document.getElementById('panelRouteName').value = '';
                }
                window.selectedDriverRoute = null;
            });
    } else {
        document.getElementById('panelOperator').innerHTML = '<option value="">-- Select Operator --</option>';
        document.getElementById('panelCompany').value = '';
        if (!originalSpaceRouteName) {
            document.getElementById('panelRouteName').value = '';
        }
        window.selectedDriverRoute = null;
    }
}

function fillCompanyFromOperator() {
    const operatorSelect = document.getElementById('panelOperator');
    const selectedOption = operatorSelect.options[operatorSelect.selectedIndex];
    document.getElementById('panelCompany').value = selectedOption.dataset.company || '';
}

function updateCountdown() {
    const mins = parseInt(document.getElementById('panelTimeMinutes').value) || 15;
    remainingSeconds = mins * 60;
    const display = String(Math.floor(remainingSeconds / 60)).padStart(2, '0') + ':' +
        String(remainingSeconds % 60).padStart(2, '0');
    
    const countdownEl = document.getElementById('countdownDisplay');
    if (countdownEl) {
        countdownEl.textContent = display;
    }
}

function editSpaceMode(e) {
    if (e) e.preventDefault();
    if (!currentSpace) return;

    selectedSpaceElement = currentSpace;
    const spaceId = currentSpace.getAttribute('data-space-id');
    const route = currentSpace.getAttribute('data-route');
    const accommodationType = currentSpace.getAttribute('data-accommodation-type');

    if (!spaceId) {
        showSpaceAlert('Invalid space selected');
        return;
    }

    const isOccupied = currentSpace.classList.contains('occupied-bay');
    const panelTitleEl = document.querySelector('.panel-title');
    const markOccupiedBtn = document.querySelector('.btn-mark-occupied');

    if (isOccupied) {
        // OCCUPIED: Show "Add Time" form
        panelTitleEl.textContent = 'Add Time to Space';
        
        document.getElementById('panelRouteName').closest('.form-group').style.display = 'none';
        document.getElementById('panelSpaceId').closest('.form-group').style.display = 'none';
        document.getElementById('panelAccommodationType').closest('.form-group').style.display = 'none';
        document.getElementById('durationSection').style.display = 'flex';
        document.getElementById('driverSection').style.display = 'none';
        document.getElementById('companyOperatorSection').style.display = 'none';
        document.getElementById('countdownDisplay').style.display = 'none';

        document.getElementById('panelTimeMinutes').value = 15;
        updateCountdown();

        markOccupiedBtn.innerHTML = '<i class="fas fa-plus me-1"></i>Add Time';
        isEditMode = true;
    } else {
        // AVAILABLE: Show "Edit Space Information"
        panelTitleEl.textContent = 'Edit Space Information';
        
        document.getElementById('panelRouteName').closest('.form-group').style.display = 'flex';
        document.getElementById('panelSpaceId').closest('.form-group').style.display = 'flex';
        document.getElementById('panelAccommodationType').closest('.form-group').style.display = 'flex';
        document.getElementById('durationSection').style.display = 'none';
        document.getElementById('driverSection').style.display = 'none';
        document.getElementById('companyOperatorSection').style.display = 'none';
        document.getElementById('countdownDisplay').style.display = 'none';

        document.getElementById('panelRouteName').value = route || '';
        document.getElementById('panelSpaceId').value = spaceId;
        document.getElementById('panelAccommodationType').value = accommodationType || '';

        document.getElementById('panelRouteName').removeAttribute('readonly');
        document.getElementById('panelRouteName').style.backgroundColor = 'white';
        
        document.getElementById('panelSpaceId').removeAttribute('readonly');
        document.getElementById('panelSpaceId').style.backgroundColor = 'white';

        markOccupiedBtn.innerHTML = '<i class="fas fa-save me-1"></i>Save Changes';
        isEditMode = true;
    }

    document.getElementById('spacePanel').classList.add('show');
    document.getElementById('svgWrapper').classList.add('with-panel');
    document.getElementById('tooltip').style.display = 'none';
    tooltipSticky = false;

    if (isOccupied) {
        refreshExtensionBanner(spaceId);
    } else {
        const banner = document.getElementById('extensionRequestBanner');
        if (banner) banner.style.display = 'none';
    }

    setTimeout(() => {
        document.getElementById('panelRouteName').focus();
    }, 300);
}

function refreshExtensionBanner(spaceId) {
    const banner = document.getElementById('extensionRequestBanner');
    if (!banner || !spaceId) return;
    fetch('/api/terminal/spaces')
        .then(res => res.json())
        .then(spacesData => {
            const s = spacesData.find(x => x.space_id === spaceId);
            if (s && s.pending_extension_minutes != null) {
                banner.style.display = 'block';
                const el = document.getElementById('pendingExtensionMins');
                if (el) el.textContent = s.pending_extension_minutes;
            } else {
                banner.style.display = 'none';
            }
        })
        .catch(() => {
            banner.style.display = 'none';
        });
}

function approveExtensionRequest(e) {
    if (e) e.preventDefault();
    const spaceId = selectedSpaceElement && selectedSpaceElement.getAttribute('data-space-id');
    if (!spaceId) return;
    fetch('/api/terminal/approve-extension', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ space_id: spaceId })
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                if (data.expiration_time) {
                    spaceExpirationTimes.set(spaceId, new Date(data.expiration_time).getTime());
                }
                showSpaceAlert('Extension approved.');
                refreshExtensionBanner(spaceId);
                loadHistoryFromDatabase(currentHistoryPage);
                closePanel();
            } else {
                showSpaceAlert(data.message || 'Failed to approve extension');
            }
        })
        .catch(err => showSpaceAlert('Error: ' + err.message));
}

function denyExtensionRequest(e) {
    if (e) e.preventDefault();
    const spaceId = selectedSpaceElement && selectedSpaceElement.getAttribute('data-space-id');
    if (!spaceId) return;
    showSpaceConfirm('Decline this extension request?').then((confirmed) => {
        if (!confirmed) return;
        fetch('/api/terminal/deny-extension', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ space_id: spaceId })
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showSpaceAlert('Extension request declined.');
                refreshExtensionBanner(spaceId);
                loadHistoryFromDatabase(currentHistoryPage);
                closePanel();
            } else {
                showSpaceAlert(data.message || 'Failed to deny extension');
            }
        })
        .catch(err => showSpaceAlert('Error: ' + err.message));
    });
}

function occupySpace(e) {
    if (e) e.preventDefault();
    if (!currentSpace) return;

    selectedSpaceElement = currentSpace;
    const spaceId = selectedSpaceElement.getAttribute('data-space-id');

    if (!spaceId) {
        showSpaceAlert('Invalid space selected');
        return;
    }

    // Add this null check
    const routeNameEl = document.getElementById('panelRouteName');
    const spaceIdEl = document.getElementById('panelSpaceId');
    if (!routeNameEl || !spaceIdEl) {
        console.error('Form elements not found!');
        return;
    }

    // Store and preserve the original space route name
    originalSpaceRouteName = selectedSpaceElement.getAttribute('data-route') || '';
    routeNameEl.value = originalSpaceRouteName;
    spaceIdEl.value = spaceId;

    document.getElementById('panelRouteName').value = originalSpaceRouteName;
    document.getElementById('panelSpaceId').value = spaceId;
    document.getElementById('panelDriver').value = '';
    document.getElementById('panelCompany').value = '';
    document.getElementById('panelOperator').value = '';
    document.getElementById('panelTimeMinutes').value = 15;
    document.getElementById('panelTimeMinutes').addEventListener('change', updateCountdown);
    document.getElementById('panelTimeMinutes').addEventListener('input', updateCountdown);
    document.getElementById('panelRouteName').closest('.form-group').style.display = 'none';
    document.getElementById('panelSpaceId').closest('.form-group').style.display = 'none';
    document.getElementById('panelAccommodationType').closest('.form-group').style.display = 'none'; // HIDE accommodation type (already set in edit mode)
    document.getElementById('durationSection').style.display = 'flex';
    document.getElementById('driverSection').style.display = 'flex';
    document.getElementById('companyOperatorSection').style.display = 'grid';
    document.getElementById('countdownDisplay').style.display = 'block';
    updateCountdown();

    document.querySelector('.panel-title').textContent = 'Occupy Space';
    const markOccupiedBtn = document.querySelector('.btn-mark-occupied');
    markOccupiedBtn.innerHTML = '<i class="fas fa-check me-1"></i>Mark as Occupied';

    document.getElementById('panelRouteName').setAttribute('readonly', 'readonly');
    document.getElementById('panelRouteName').style.backgroundColor = '#f8f9fa';
    document.getElementById('panelSpaceId').setAttribute('readonly', 'readonly');
    document.getElementById('panelSpaceId').style.backgroundColor = '#f8f9fa';

    isEditMode = false;

    // document.getElementById('markCompleteBtn').style.display = selectedSpaceElement.classList.contains('occupied-bay') ? 'block' : 'none';

    document.getElementById('spacePanel').classList.add('show');
    document.getElementById('svgWrapper').classList.add('with-panel');
    document.getElementById('tooltip').style.display = 'none';
    tooltipSticky = false;
}

function closePanel() {
    document.querySelector('.panel-title').textContent = 'Space Details';
    document.querySelector('.btn-mark-occupied').innerHTML = '<i class="fas fa-check me-1"></i>Mark as Occupied';

    const extBanner = document.getElementById('extensionRequestBanner');
    if (extBanner) extBanner.style.display = 'none';

    document.getElementById('panelRouteName').closest('.form-group').style.display = 'flex';
    document.getElementById('panelSpaceId').closest('.form-group').style.display = 'flex';
    document.getElementById('panelAccommodationType').closest('.form-group').style.display = 'none';
    document.getElementById('durationSection').style.display = 'none';
    document.getElementById('driverSection').style.display = 'none';
    document.getElementById('companyOperatorSection').style.display = 'none';
    document.getElementById('countdownDisplay').style.display = 'none';

    document.getElementById('spacePanel').classList.remove('show');
    document.getElementById('svgWrapper').classList.remove('with-panel');
    if (countdownTimer) clearInterval(countdownTimer);
    if (tooltipCountdownTimer) {
        clearInterval(tooltipCountdownTimer);
        tooltipCountdownTimer = null;
    }
    currentSpace = null;
    selectedSpaceElement = null;
    isEditMode = false;
    originalSpaceRouteName = null;
    closeTooltip();
}

function updateCountdownDisplay() {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    const countdownEl = document.getElementById('countdownDisplay');
    if (countdownEl) {
        countdownEl.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
}

function markSpaceComplete() {
    if (!selectedSpaceElement) {
        showSpaceAlert('No space selected');
        return;
    }

    const spaceId = selectedSpaceElement.getAttribute('data-space-id');
    if (!spaceId) return;

    showSpaceConfirm('Mark this space as complete and available?').then((confirmed) => {
        if (!confirmed) return;
        fetch('/api/terminal/release', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({ space_id: spaceId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Space marked as complete');
                showSpaceAlert('Space is now available!', 'success');
                selectedSpaceElement.classList.remove('occupied-bay');
                selectedSpaceElement.style.fill = '#35d335'; // Green
                closePanel();
                loadHistoryFromDatabase(currentHistoryPage);
            } else {
                showSpaceAlert('Error: ' + data.message, 'error');
            }
        })
        .catch(error => console.error('Complete error:', error));
    });
}

function saveSpaceOccupancy() {
    if (!selectedSpaceElement) {
        showSpaceAlert('No space selected');
        return;
    }

    const spaceId = selectedSpaceElement.getAttribute('data-space-id') || '';
    const isOccupied = selectedSpaceElement.classList.contains('occupied-bay');
    
    // PROPERLY CLAMP DURATION
    let minsRaw = parseInt(document.getElementById('panelTimeMinutes').value);
    const mins = Math.max(Math.min(minsRaw, 360), 1);

    if (isEditMode && isOccupied) {
        // ADD TIME TO OCCUPIED SPACE
        if (mins < 1) {
            showSpaceAlert('Please enter at least 1 minute');
            return;
        }

        fetch('/api/terminal/add-time', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({
                space_id: spaceId,
                additional_minutes: mins
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update expiration time if provided
                if (data.expiration_time) {
                    spaceExpirationTimes.set(spaceId, new Date(data.expiration_time).getTime());
                    // Refresh tooltip if it's currently showing this space
                    if (currentSpace && currentSpace.getAttribute('data-space-id') === spaceId) {
                        updateTooltip(currentSpace);
                    }
                }
                showSpaceAlert(`✓ Added ${mins} minutes to space`);
                loadHistoryFromDatabase(currentHistoryPage);
                closePanel();
            } else {
                showSpaceAlert('Error: ' + (data.message || 'Failed to add time'));
            }
        })
        .catch(error => {
            console.error('Error adding time:', error);
            showSpaceAlert('Error adding time: ' + error.message);
        });
    } else if (isEditMode && !isOccupied) {
        // EDIT SPACE DETAILS (for available space)
        const newRouteName = document.getElementById('panelRouteName').value || '';
        const accType = document.getElementById('panelAccommodationType').value;
        
        if (!newRouteName && !accType) {
            showSpaceAlert('Please enter at least a route name or accommodation type');
            return;
        }

        fetch('/api/terminal/update-space', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({
                space_id: spaceId,
                route_name: newRouteName,
                accommodation_type: accType
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                selectedSpaceElement.setAttribute('data-route', newRouteName);
                selectedSpaceElement.setAttribute('data-accommodation-type', accType);
                showSpaceAlert('Space updated successfully!');
                loadHistoryFromDatabase(currentHistoryPage);
                closePanel();
            } else {
                showSpaceAlert('Error: ' + (data.message || 'Failed to update space'));
            }
        })
        .catch(error => {
            console.error('Error updating space:', error);
            showSpaceAlert('Error updating space: ' + error.message);
        });
    } else {
        // OCCUPY MODE
        const driverId = document.getElementById('panelDriver').value;
        const operatorId = document.getElementById('panelOperator').value || null;
        
        if (!driverId) {
            showSpaceAlert('Please select a driver');
            return;
        }

        if (!spaceId) {
            showSpaceAlert('Invalid space selected');
            return;
        }

        const occupyPayload = {
            space_id: spaceId,
            driver_id: parseInt(driverId),
            operator_id: operatorId ? parseInt(operatorId) : null,
            duration_minutes: mins,
            route_name: document.getElementById('panelRouteName').value || null,
            accommodation_type: document.getElementById('panelAccommodationType').value || null
        };

        console.log('Sending occupy request:', occupyPayload);
        console.log('Space ID:', spaceId, 'Driver ID:', driverId, 'Duration:', mins);

        fetch('/api/terminal/occupy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify(occupyPayload)
        })
        .then(response => response.json().then(data => ({ status: response.status, data })))
        .then(({ status, data }) => {
            console.log('Occupy response:', data, 'Status:', status);
            
            if (status === 200 || data.success) {
                selectedSpaceElement.setAttribute('fill', '#dc3545');
                selectedSpaceElement.classList.remove('cls-9');
                selectedSpaceElement.classList.add('occupied-bay');
                
                // Set expiration time if provided
                if (data.expiration_time) {
                    spaceExpirationTimes.set(spaceId, new Date(data.expiration_time).getTime());
                }
                
                showSpaceAlert('Space occupied successfully!', 'success');
                loadHistoryFromDatabase(currentHistoryPage);
                closePanel();
            } else {
                let errorMsg = data.message || 'Failed to occupy space';
                if (data.errors) {
                    console.error('Validation errors:', data.errors);
                    errorMsg += '\n' + Object.entries(data.errors).map(([key, msgs]) => `${key}: ${msgs.join(', ')}`).join('\n');
                }
                showSpaceAlert('Error: ' + errorMsg);
            }
        })
        .catch(error => {
            console.error('Error occupying space:', error);
            showSpaceAlert('Error: ' + error.message);
        });
    }
}

function releaseSpace() {
    if (!currentSpace) return;

    const spaceId = currentSpace.getAttribute('data-space-id');
    if (!spaceId) return;

    fetch('/api/terminal/release', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ space_id: spaceId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentSpace.setAttribute('fill', '#35d335');
            currentSpace.classList.remove('occupied-bay');
            currentSpace.classList.add('cls-9');
            occupiedSpaces.delete(spaceId);
            spaceExpirationTimes.delete(spaceId);

            loadHistoryFromDatabase(currentHistoryPage);
            updateTooltip(currentSpace);
            closePanel();
        }
    })
    .catch(error => console.error('Release error:', error));
}

function cancelSpaceOccupancy(e) {
    if (e) e.preventDefault();
    if (!currentSpace) return;

    const spaceId = currentSpace.getAttribute('data-space-id');
    const spaceElement = currentSpace;
    if (!spaceId) return;

    // Show modal for cancellation reason
    showReasonModal('Cancel Occupancy', 'Cancel', function(reason) {
        fetch('/api/terminal/cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({
                space_id: spaceId,
                reason: reason || 'Cancelled by operator'
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showSpaceAlert('Occupancy cancelled.', 'success');
                if (spaceElement) {
                    spaceElement.setAttribute('fill', '#35d335');
                    spaceElement.classList.remove('occupied-bay');
                    spaceElement.classList.add('cls-9');
                }
                occupiedSpaces.delete(spaceId);
                spaceExpirationTimes.delete(spaceId);
                loadHistoryFromDatabase(currentHistoryPage);
                closeTooltip();
            } else {
                showSpaceAlert('Error: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Cancel error:', error);
            showSpaceAlert('Error cancelling occupancy: ' + error.message);
        });
    });
}


function showReasonModal(title, actionBtn, callback) {
    const modal = document.getElementById('reasonModal');
    const titleEl = document.getElementById('reasonModalTitle');
    const input = document.getElementById('reasonModalInput');
    const confirmBtn = document.getElementById('reasonModalConfirm');
    const cancelBtn = document.getElementById('reasonModalCancel');

    titleEl.textContent = title;
    confirmBtn.textContent = actionBtn;
    input.value = '';
    
    modal.style.display = 'flex';

    const handleConfirm = () => {
        const reason = input.value.trim();
        modal.style.display = 'none';
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        callback(reason || null);
    };

    const handleCancel = () => {
        modal.style.display = 'none';
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);

    input.focus();
}

function addHistory(spaceId, route, action, details) {
    console.log('History added:', { spaceId, route, action, details });
}

function loadHistoryFromDatabase(page = 1) {
    const searchFilter = document.getElementById('searchFilter')?.value || '';
    const dateFromFilter = document.getElementById('dateFromFilter')?.value || '';
    const dateToFilter = document.getElementById('dateToFilter')?.value || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const driverFilter = document.getElementById('driverFilter')?.value || '';
    const routeFilter = document.getElementById('routeFilter')?.value || '';

    const params = new URLSearchParams();
    if (searchFilter) params.append('search', searchFilter);
    if (dateFromFilter) params.append('date_from', dateFromFilter);
    if (dateToFilter) params.append('date_to', dateToFilter);
    if (statusFilter) params.append('action', statusFilter);
    if (driverFilter) params.append('driver_id', driverFilter);
    if (routeFilter) params.append('route_name', routeFilter);
    params.append('page', page);

    fetch(`/api/terminal/history-all?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            currentHistoryPage = data.current_page; // Track current page
            updateHistoryTable(data.data || []);
            updateHistoryPagination(data);
        })
        .catch(error => console.error('Error loading history:', error));
}

function updateHistoryPagination(data) {
    const paginationEl = document.getElementById('historyPagination');
    if (!paginationEl) return;
    
    paginationEl.innerHTML = '';

    // Previous page button
    if (data.current_page > 1) {
        const prevBtn = document.createElement('li');
        prevBtn.className = 'page-item';
        prevBtn.innerHTML = `<a class="page-link" href="#" onclick="loadHistoryFromDatabase(${data.current_page - 1}); return false;">Previous</a>`;
        paginationEl.appendChild(prevBtn);
    }

    // Page numbers
    for (let i = 1; i <= data.last_page; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === data.current_page ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" onclick="loadHistoryFromDatabase(${i}); return false;">${i}</a>`;
        paginationEl.appendChild(li);
    }

    // Next page button
    if (data.current_page < data.last_page) {
        const nextBtn = document.createElement('li');
        nextBtn.className = 'page-item';
        nextBtn.innerHTML = `<a class="page-link" href="#" onclick="loadHistoryFromDatabase(${data.current_page + 1}); return false;">Next</a>`;
        paginationEl.appendChild(nextBtn);
    }
}

function updateHistoryTable(records = []) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    records.forEach((record) => {
        const row = document.createElement('tr');
        
        const actionBadgeColor = getActionColor(record.action);
        
        // ALWAYS show View button only
        const actionButtons = `<button class="btn btn-sm btn-info" onclick="showHistoryDetail(${record.id})" style="padding: 4px 8px; font-size: 11px;"><i class="fas fa-eye me-1"></i>View</button>`;
        
        // Determine time released display - show N/A for 'edited' action
        let timeReleasedDisplay = 'Ongoing';
        if (record.action === 'edited') {
            timeReleasedDisplay = 'N/A';
        } else if (record.time_released) {
            timeReleasedDisplay = new Date(record.time_released).toLocaleString();
        }
        
        row.innerHTML = `
            <td>${record.space_id}</td>
            <td>${record.route_name || 'N/A'}</td>
            <td>${record.driver_name || 'N/A'}</td>
            <td><span class="badge" style="background-color: ${actionBadgeColor};">${record.action.toUpperCase()}</span></td>
            <td>${new Date(record.time_occupied).toLocaleString()}</td>
            <td>${timeReleasedDisplay}</td>
            <td>${actionButtons}</td>
        `;
        
        tbody.appendChild(row);
    });
}

function completeOccupancy(spaceId, recordId, buttonEl) {
    // Disable the button immediately
    if (buttonEl) {
        buttonEl.disabled = true;
        buttonEl.style.background = '#ccc';
        buttonEl.style.color = '#999';
        buttonEl.style.cursor = 'not-allowed';
    }

    showReasonModal('Complete Space', 'Complete', function(notes) {
        fetch('/api/terminal/release', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({ 
                space_id: spaceId,
                notes: notes
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadHistoryFromDatabase(currentHistoryPage);
                
                // Update UI - find and turn space green
                const spaceEl = document.querySelector(`[data-space-id="${spaceId}"]`);
                if (spaceEl) {
                    spaceEl.classList.remove('occupied-bay');
                    spaceEl.classList.add('cls-9');
                    spaceEl.setAttribute('fill', '#35d335');
                    spaceEl.setAttribute('data-status', 'available');
                }
            }
        })
        .catch(error => {
            console.error('Complete error:', error);
            // Re-enable button on error
            if (buttonEl) {
                buttonEl.disabled = false;
                buttonEl.style.background = '#28a745';
                buttonEl.style.color = 'white';
                buttonEl.style.cursor = 'pointer';
            }
        });
    });
}

function cancelOccupancyFromHistory(spaceId, recordId, buttonEl) {
    // Disable the button immediately
    if (buttonEl) {
        buttonEl.disabled = true;
        buttonEl.style.background = '#ccc';
        buttonEl.style.color = '#999';
        buttonEl.style.cursor = 'not-allowed';
    }

    showReasonModal('Cancel Occupancy', 'Cancel', function(reason) {
        fetch('/api/terminal/cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({ 
                space_id: spaceId,
                reason: reason
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadHistoryFromDatabase(currentHistoryPage);
                
                // Update UI - find and turn space green
                const spaceEl = document.querySelector(`[data-space-id="${spaceId}"]`);
                if (spaceEl) {
                    spaceEl.classList.remove('occupied-bay');
                    spaceEl.classList.add('cls-9');
                    spaceEl.setAttribute('fill', '#35d335');
                    spaceEl.setAttribute('data-status', 'available');
                }
            }
        })
        .catch(error => {
            console.error('Cancel error:', error);
            // Re-enable button on error
            if (buttonEl) {
                buttonEl.disabled = false;
                buttonEl.style.background = '#dc3545';
                buttonEl.style.color = 'white';
                buttonEl.style.cursor = 'pointer';
            }
        });
    });
}

function showHistoryDetail(recordId) {
    // Fetch the specific record with all details
    fetch(`/api/terminal/history-detail/${recordId}`)
        .then(response => response.json())
        .then(record => {
            const timeOccupied = record.time_occupied ? new Date(record.time_occupied).toLocaleString() : 'N/A';
            const timeReleased = record.time_released ? new Date(record.time_released).toLocaleString() : 'Ongoing';
            const durationMins = record.duration_minutes ? `${record.duration_minutes} minutes` : 'N/A';
            
            // Determine which notes/reason to show based on action type
            let notesLabel = 'Notes';
            let notesValue = 'N/A';
            
            if (record.action === 'occupied') {
                notesLabel = 'Duration Notes';
                notesValue = record.additional_notes || 'N/A';
            } else if (record.action === 'released') {
                notesLabel = 'Release Notes';
                notesValue = record.additional_notes || 'Manually released';
            } else if (record.action === 'cancelled') {
                notesLabel = 'Cancellation Reason';
                notesValue = record.reason_for_cancellation || 'Cancelled by operator';
            }

            const detailHTML = `
                <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; align-items: center; justify-content: center;" onclick="closeHistoryDetail(event)">
                    <div style="background: white; border-radius: 12px; padding: 28px; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.2);" onclick="event.stopPropagation()">
                        <h3 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 20px; font-weight: 700;">Activity Details</h3>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Space ID</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #2b7be4; font-weight: 700;">${record.space_id}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Action</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333;">${record.action.toUpperCase()}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Route Name</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333;">${record.route_name || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Accommodation Type</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333;">${record.accommodation_type || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Driver Name</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333;">${record.driver_name || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Driver Contact</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333;">${record.driver_contact || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Bus Operator</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333;">${record.bus_operator_name || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Company Name</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333;">${record.company_name || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Operator Email</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333;">${record.bus_operator_email || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Company Contact</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333;">${record.company_contact || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Duration</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333;">${durationMins}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Time Occupied</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333;">${timeOccupied}</p>
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">Time Released</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333;">${timeReleased}</p>
                            </div>
                            <div style="grid-column: 1 / -1;">
                                <p style="margin: 0; font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase;">${notesLabel}</p>
                                <p style="margin: 5px 0 15px 0; font-size: 14px; color: #333; padding: 10px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #2b7be4;">${notesValue}</p>
                            </div>
                        </div>
                        
                        <button onclick="closeHistoryDetail()" style="width: 100%; margin-top: 20px; padding: 12px; background: #2b7be4; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;">Close</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', detailHTML);
        })
        .catch(error => console.error('Error loading detail:', error));
}

function closeHistoryDetail(e) {
    if (e) e.stopPropagation();
    const overlay = document.querySelector('div[style*="position: fixed"][style*="z-index: 2000"]');
    if (overlay) overlay.remove();
}

function getActionColor(action) {
    switch(action) {
        case 'occupied': return '#dc3545';
        case 'released': return '#28a745';
        case 'cancelled': return '#ffc107';
        case 'edited': return '#17a2b8';
        default: return '#6c757d';
    }
}

function initializeDateFilter() {
    const today = new Date().toISOString().split('T')[0];
    const dateFromFilter = document.getElementById('dateFromFilter');
    const dateToFilter = document.getElementById('dateToFilter');
    
    if (dateFromFilter) {
        dateFromFilter.value = today;
        dateFromFilter.max = today;
    }
    
    if (dateToFilter) {
        dateToFilter.value = today;
        dateToFilter.max = today;
    }

    // Populate driver and route dropdowns
    populateDriverFilter();
    populateRouteFilter();
    
    // Load history with today's date by default
    loadHistoryFromDatabase();
}

function populateDriverFilter() {
    fetch('/api/terminal/history-all')
        .then(response => response.json())
        .then(data => {
            const driverFilter = document.getElementById('driverFilter');
            if (!driverFilter || !data.data) return;

            const drivers = new Map();
            data.data.forEach(record => {
                if (record.driver_name && record.driver_id) {
                    drivers.set(record.driver_id, record.driver_name);
                }
            });

            // Create options from the map
            drivers.forEach((name, id) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                driverFilter.appendChild(option);
            });
        })
        .catch(error => console.error('Error loading drivers:', error));
}

function populateRouteFilter() {
    fetch('/api/terminal/routes')
        .then(response => response.json())
        .then(routes => {
            const routeFilter = document.getElementById('routeFilter');
            if (!routeFilter || !routes) return;

            // Create options from the routes array
            routes.forEach(route => {
                const option = document.createElement('option');
                option.value = route;
                option.textContent = route;
                routeFilter.appendChild(option);
            });
        })
        .catch(error => console.error('Error loading routes:', error));
}

function checkAndReleaseExpiredSpaces() {
    fetch('/api/terminal/check-expired') 
        .then(res => res.json())
        .then(data => {
            if (data.released_count > 0) {
                console.log(`✓ Auto-released ${data.released_count} expired spaces:`, data.spaces);
                
                // Update UI for released spaces
                data.spaces.forEach(spaceId => {
                    const spaceEl = document.querySelector(`[data-space-id="${spaceId}"]`);
                    if (spaceEl) {
                        spaceEl.classList.remove('occupied-bay');
                        spaceEl.classList.add('cls-9');
                        spaceEl.setAttribute('fill', '#35d335');
                        spaceEl.setAttribute('data-status', 'available');
                        spaceExpirationTimes.delete(spaceId);
                        console.log(`✓ Updated space ${spaceId} to available (green)`);
                    }
                });
                
                // Reload history - show page 1 for auto-released items
                loadHistoryFromDatabase(1);
            }
        })
        .catch(err => console.error('Error checking expired spaces:', err));
}

function refreshSpaces() {
    location.reload();
}

function downloadHistoryData() {
    const searchFilter = document.getElementById('searchFilter')?.value || '';
    const dateFromFilter = document.getElementById('dateFromFilter')?.value || '';
    const dateToFilter = document.getElementById('dateToFilter')?.value || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const driverFilter = document.getElementById('driverFilter')?.value || '';
    const routeFilter = document.getElementById('routeFilter')?.value || '';

    const params = new URLSearchParams();
    if (searchFilter) params.append('search', searchFilter);
    if (dateFromFilter) params.append('date_from', dateFromFilter);
    if (dateToFilter) params.append('date_to', dateToFilter);
    if (statusFilter) params.append('action', statusFilter);
    if (driverFilter) params.append('driver_id', driverFilter);
    if (routeFilter) params.append('route_name', routeFilter);
    params.append('export', 'csv'); // Request CSV format

    // Redirect to the download URL
    window.location.href = `/api/terminal/history-all?${params.toString()}`;
}
