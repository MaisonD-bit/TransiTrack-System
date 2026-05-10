document.addEventListener('DOMContentLoaded', function() {
    let gateRoutes = {};
    let gateReservations = {};
    let reservationsHistory = [];
    let currentPage = 1;
    const pageSize = 10;

    // Load saved routes from localStorage
    document.querySelectorAll('.gate-card').forEach(card => {
        const gateId = card.dataset.spaceId;
        const savedRoute = localStorage.getItem(`gateRoute_${gateId}`);
        if (savedRoute) {
            gateRoutes[gateId] = savedRoute;
        }
    });

    // Change Route button
    document.querySelectorAll('.change-route-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const gateId = this.dataset.gate;
            document.getElementById('modal-gate-name').textContent = gateId;
            document.getElementById('selectedGateId').value = gateId;
            document.getElementById('gate_route_id').value = '';
            const modal = new bootstrap.Modal(document.getElementById('changeRouteModal'));
            modal.show();
        });
    });

    // Save route for gate
    document.getElementById('changeRouteForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const gateId = document.getElementById('selectedGateId').value;
        const routeSelect = document.getElementById('gate_route_id');
        let routeText = routeSelect.options[routeSelect.selectedIndex].text;
        if (routeText.includes(' to ')) {
            routeText = routeText.split(' to ').pop();
        }
        gateRoutes[gateId] = routeText;
        localStorage.setItem(`gateRoute_${gateId}`, routeText);

        // Properly hide modal and remove stuck backdrop and modal-open
        const modalEl = document.getElementById('changeRouteModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
        setTimeout(() => {
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        }, 300);

        showAlert(`Route for ${gateId} updated!`, 'success');
    });

    // Gate reservation logic
    document.querySelectorAll('.gate-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.classList.contains('change-route-btn')) return;
            const gateId = this.dataset.spaceId;
            if (gateReservations[gateId]) {
                showAlert('This gate is currently reserved.', 'warning');
                return;
            }
            document.getElementById('modal-reserve-gate-name').textContent = gateId;
            document.getElementById('reserveGateId').value = gateId;
            document.getElementById('reserve_driver_id').value = '';
            document.getElementById('reserve_bus_id').value = '';
            document.getElementById('reserve_minutes').value = '15';
            const routeName = gateRoutes[gateId] || 'No Route';
            document.getElementById('modal-reserve-gate-route').textContent = routeName;
            const modal = new bootstrap.Modal(document.getElementById('gateReservationModal'));
            modal.show();
        });
    });

    // Save reservation
    document.getElementById('gateReservationForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const gateId = document.getElementById('reserveGateId').value;
        const driverId = document.getElementById('reserve_driver_id').value;
        const busId = document.getElementById('reserve_bus_id').value;
        const minutes = parseInt(document.getElementById('reserve_minutes').value, 10);

        // Only allow 15 or 20 minutes
        if (![15, 20].includes(minutes)) {
            showAlert('Duration must be 15 or 20 minutes.', 'danger');
            return;
        }

        if (!driverId || !busId || !minutes) {
            showAlert('Please fill in all required fields.', 'danger');
            return;
        }

        gateReservations[gateId] = {
            driverId,
            busId,
            minutes,
            reservedAt: Date.now(),
            timeoutId: null
        };

        const card = document.querySelector(`.gate-card[data-space-id="${gateId}"]`);
        if (card) {
            card.classList.add('bg-danger', 'text-white');
            const changeBtn = card.querySelector('.change-route-btn');
            if (changeBtn) changeBtn.disabled = true;
            const gateRouteDiv = card.querySelector('.gate-route');
            if (gateRouteDiv) {
                gateRouteDiv.innerHTML = `<span>Reserved for ${minutes} min</span>`;
            }
        }

        // Properly hide modal and remove stuck backdrop and modal-open
        const modalEl = document.getElementById('gateReservationModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
        setTimeout(() => {
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        }, 300);

        showAlert(`Gate ${gateId} reserved for ${minutes} minutes.`, 'success');
        addReservationToHistory(gateId, driverId, busId, minutes);

        const timeoutId = setTimeout(() => {
            cancelReservation(gateId, false);
        }, minutes * 60 * 1000);
        gateReservations[gateId].timeoutId = timeoutId;
    });

    // Cancel reservation handler (from table)
    document.getElementById('bookings-summary').addEventListener('click', function(e) {
        if (e.target.classList.contains('cancel-reservation-btn')) {
            const gateId = e.target.dataset.gateId;
            cancelReservation(gateId, true);
        }
        if (e.target.classList.contains('reservation-page-btn')) {
            const page = parseInt(e.target.dataset.page, 10);
            if (!isNaN(page)) {
                currentPage = page;
                updateReservationsSummary();
            }
        }
    });

    function cancelReservation(gateId, manual = true) {
        if (!gateReservations[gateId]) return;
        if (manual && gateReservations[gateId].timeoutId) {
            clearTimeout(gateReservations[gateId].timeoutId);
        }
        delete gateReservations[gateId];
        const card = document.querySelector(`.gate-card[data-space-id="${gateId}"]`);
        if (card) {
            card.classList.remove('bg-danger', 'text-white');
            const changeBtn = card.querySelector('.change-route-btn');
            if (changeBtn) changeBtn.disabled = false;
            const gateRouteDiv = card.querySelector('.gate-route');
            if (gateRouteDiv) {
                gateRouteDiv.innerHTML = `<span id="gate-route-${gateId}">${gateRoutes[gateId] || 'No Route'}</span>`;
            }
        }
        reservationsHistory.forEach(res => {
            if (res.gateId === gateId && res.active) res.active = false;
        });
        updateReservationsSummary();
        showAlert(`Reservation for ${gateId} cancelled.`, manual ? 'info' : 'success');
    }

    function addReservationToHistory(gateId, driverId, busId, minutes) {
        const driverSelect = document.getElementById('reserve_driver_id');
        const busSelect = document.getElementById('reserve_bus_id');
        let driverText = '';
        let busText = '';
        if (driverSelect) {
            const opt = driverSelect.querySelector(`option[value="${driverId}"]`);
            driverText = opt ? opt.textContent : driverId;
        }
        if (busSelect) {
            const opt = busSelect.querySelector(`option[value="${busId}"]`);
            busText = opt ? opt.textContent : busId;
        }
        let routeText = gateRoutes[gateId] || 'No Route';
        const reservation = {
            gateId,
            routeText,
            driverText,
            busText,
            minutes,
            timestamp: new Date().toLocaleString(),
            active: true
        };
        reservationsHistory = reservationsHistory.filter(res => res.gateId !== gateId || res.active === false);
        reservationsHistory.unshift(reservation);
        updateReservationsSummary();
    }

    function updateReservationsSummary() {
        const summary = document.getElementById('bookings-summary');
        if (!summary) return;
        summary.innerHTML = '';
        if (reservationsHistory.length === 0) {
            summary.innerHTML = '<p class="text-muted text-center mb-0">No reservations yet.</p>';
            return;
        }
        const total = reservationsHistory.length;
        const totalPages = Math.ceil(total / pageSize);
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        const startIdx = (currentPage - 1) * pageSize;
        const endIdx = Math.min(startIdx + pageSize, total);

        const table = document.createElement('table');
        table.className = 'table table-bordered table-sm align-middle mb-0';
        table.innerHTML = `
            <thead class="table-light">
                <tr>
                    <th>Gate</th>
                    <th>Route</th>
                    <th>Driver</th>
                    <th>Bus</th>
                    <th>Duration</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        reservationsHistory.slice(startIdx, endIdx).forEach(res => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${res.gateId}</td>
                <td>${res.routeText}</td>
                <td>${res.driverText}</td>
                <td>${res.busText}</td>
                <td>${res.minutes} min</td>
                <td>${res.timestamp}</td>
                <td>
                    ${res.active
                        ? `<button class="btn btn-sm btn-danger cancel-reservation-btn" data-gate-id="${res.gateId}">Cancel</button>`
                        : `<span class="badge bg-secondary">Ended</span>`
                    }
                </td>
            `;
            tbody.appendChild(tr);
        });
        summary.appendChild(table);

        if (totalPages > 1) {
            const nav = document.createElement('nav');
            nav.className = 'mt-2';
            let html = `<ul class="pagination pagination-sm justify-content-center mb-0">`;
            html += `<li class="page-item${currentPage === 1 ? ' disabled' : ''}">
                        <button class="page-link reservation-page-btn" data-page="${currentPage - 1}">Previous</button>
                    </li>`;
            for (let i = 1; i <= totalPages; i++) {
                html += `<li class="page-item${i === currentPage ? ' active' : ''}">
                            <button class="page-link reservation-page-btn" data-page="${i}">${i}</button>
                        </li>`;
            }
            html += `<li class="page-item${currentPage === totalPages ? ' disabled' : ''}">
                        <button class="page-link reservation-page-btn" data-page="${currentPage + 1}">Next</button>
                    </li>`;
            html += `</ul>`;
            nav.innerHTML = html;
            summary.appendChild(nav);
        }
    }

    function showAlert(message, type = 'info') {
        let alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
        alertDiv.style.zIndex = 9999;
        alertDiv.textContent = message;
        document.body.appendChild(alertDiv);
        setTimeout(() => {
            alertDiv.remove();
        }, 2000);
    }

    // Remove stuck modal backdrop and modal-open after any modal is hidden
    ['changeRouteModal', 'gateReservationModal'].forEach(modalId => {
        const modalEl = document.getElementById(modalId);
        if (modalEl) {
            modalEl.addEventListener('hidden.bs.modal', function () {
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            });
        }
    });

    // Ensure route name is shown in reservation modal
    document.getElementById('gateReservationModal').addEventListener('show.bs.modal', function () {
        const gateId = document.getElementById('reserveGateId').value;
        const routeName = gateRoutes[gateId] || 'No Route';
        document.getElementById('modal-reserve-gate-route').textContent = routeName;
    });

    // Restrict duration select to only 15 and 20 minutes
    const minutesSelect = document.getElementById('reserve_minutes');
    if (minutesSelect) {
        minutesSelect.innerHTML = `
            <option value="15">15 minutes</option>
            <option value="20">20 minutes</option>
        `;
    }
});