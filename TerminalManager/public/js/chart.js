// Dashboard analytics charts (Terminal Manager)

function loadDashboardChartData() {
    const jsonEl = document.getElementById('dashboard-chart-data');
    if (!jsonEl || !jsonEl.textContent) {
        return { status_counts: {}, occupancy_by_hour: [] };
    }
    try {
        const cfg = JSON.parse(jsonEl.textContent.trim());
        return {
            status_counts: cfg.status_counts && typeof cfg.status_counts === 'object' ? cfg.status_counts : {},
            occupancy_by_hour: Array.isArray(cfg.occupancy_by_hour) ? cfg.occupancy_by_hour : [],
        };
    } catch (e) {
        console.error('Error parsing dashboard chart data:', e);
        return { status_counts: {}, occupancy_by_hour: [] };
    }
}

function occupancyBarColor(value, maxOccupancy) {
    const max = maxOccupancy > 0 ? maxOccupancy : 1;
    const percentage = (Number(value) / max) * 100;
    if (percentage >= 80) return '#e74c3c';
    if (percentage >= 60) return '#e6b800';
    if (percentage >= 40) return '#3498db';
    return '#1bb76e';
}

document.addEventListener('DOMContentLoaded', function () {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js library is not loaded');
        return;
    }

    const { status_counts: statusCounts, occupancy_by_hour: occupancyRaw } = loadDashboardChartData();
    const occupancySeries = occupancyRaw.length === 24
        ? occupancyRaw
        : Array.from({ length: 24 }, (_, i) => Number(occupancyRaw[i]) || 0);

    const statusCtx = document.getElementById('scheduleStatusChart');
    if (statusCtx) {
        const statusValues = [
            Number(statusCounts.completed) || 0,
            Number(statusCounts.active) || 0,
            Number(statusCounts.scheduled) || 0,
            Number(statusCounts.cancelled) || 0,
        ];
        const statusTotal = statusValues.reduce((sum, n) => sum + n, 0);

        new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Active', 'Scheduled', 'Cancelled'],
                datasets: [{
                    data: statusTotal > 0 ? statusValues : [1, 0, 0, 0],
                    backgroundColor: statusTotal > 0
                        ? ['#1bb76e', '#2b7be4', '#e6b800', '#e74c3c']
                        : ['#dee2e6', '#dee2e6', '#dee2e6', '#dee2e6'],
                    borderColor: '#fff',
                    borderWidth: 3,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 15, font: { size: 12 } },
                    },
                    tooltip: {
                        filter: () => statusTotal > 0,
                        callbacks: {
                            label(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0';
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            },
                        },
                    },
                },
            },
        });
    }

    const occupancyCtx = document.getElementById('occupancyByHourChart');
    if (occupancyCtx) {
        const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0') + ':00');
        const maxOccupancy = Math.max(...occupancySeries, 1);
        const barColors = occupancySeries.map((value) => occupancyBarColor(value, maxOccupancy));

        new Chart(occupancyCtx, {
            type: 'bar',
            data: {
                labels: hours,
                datasets: [{
                    label: 'Occupancy events',
                    data: occupancySeries,
                    backgroundColor: barColors,
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1,
                    borderRadius: 4,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: { padding: 15, font: { size: 12 } },
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel(context) {
                                const value = context.parsed.y ?? 0;
                                const percentage = ((value / maxOccupancy) * 100).toFixed(1);
                                return 'Relative load: ' + percentage + '%';
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        title: { display: true, text: 'Number of occupancy records' },
                    },
                    x: {
                        title: { display: true, text: 'Time of day' },
                    },
                },
            },
        });
    }
});

// Real-time update of available spaces
document.addEventListener('DOMContentLoaded', function () {
    const updateAvailableSpaces = function () {
        fetch('/api/dashboard/available-spaces')
            .then((response) => response.json())
            .then((data) => {
                const spacesElement = document.querySelector('[data-available-spaces]');
                if (spacesElement) {
                    spacesElement.textContent = data.available + ' / ' + data.total;
                }
            })
            .catch((error) => console.error('Error updating spaces:', error));
    };

    updateAvailableSpaces();
    setInterval(updateAvailableSpaces, 10000);

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            updateAvailableSpaces();
        }
    });
});
