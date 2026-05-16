// Initialize Schedule Status Chart
document.addEventListener('DOMContentLoaded', function() {
    // Get chart container and read data from attributes
    const chartContainer = document.getElementById('scheduleStatusChart');
    if (!chartContainer) {
        console.error('Chart container not found');
        return;
    }

    let statusData = [];
    let occupancyData = [];

    try {
        const statusAttr = chartContainer.dataset.status;
        const occupancyAttr = chartContainer.dataset.occupancy;
        
        if (statusAttr) {
            statusData = JSON.parse(statusAttr);
        }
        if (occupancyAttr) {
            occupancyData = JSON.parse(occupancyAttr);
        }
    } catch (e) {
        console.error('Error parsing chart data:', e);
    }

    if (!statusData || !occupancyData) {
        console.error('Analytics data not initialized');
        return;
    }

    // Create pie chart for schedule status
    const ctx = document.getElementById('scheduleStatusChart');
    if (ctx) {
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [
                    'Completed',
                    'Active',
                    'Scheduled',
                    'Cancelled'
                ],
                datasets: [{
                    data: [
                        statusData.completed || 0,
                        statusData.active || 0,
                        statusData.scheduled || 0,
                        statusData.cancelled || 0
                    ],
                    backgroundColor: [
                        '#1bb76e',
                        '#2b7be4',
                        '#e6b800',
                        '#e74c3c'
                    ],
                    borderColor: '#fff',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return context.label + ': ' + context.parsed + ' (' + percentage + '%)';
                            }
                        }
                    }
                }
            }
        });
    }

    const occupancyCtx = document.getElementById('occupancyByHourChart');
    if (occupancyCtx) {
        const hours = Array.from({
            length: 24
        }, (_, i) => i.toString().padStart(2, '0') + ':00');
        const maxOccupancy = Math.max(...occupancyData, 1);

        new Chart(occupancyCtx, {
            type: 'bar',
            data: {
                labels: hours,
                datasets: [{
                    label: 'Occupancy events',
                    data: occupancyData,
                    backgroundColor: function(context) {
                        const value = context.parsed.y;
                        const percentage = (value / maxOccupancy) * 100;
                        if (percentage >= 80) return '#e74c3c';
                        if (percentage >= 60) return '#e6b800';
                        if (percentage >= 40) return '#3498db';
                        return '#1bb76e';
                    },
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'x',
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                const value = context.parsed.y;
                                const percentage = ((value / maxOccupancy) * 100).toFixed(1);
                                return 'Relative load: ' + percentage + '%';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        },
                        title: {
                            display: true,
                            text: 'Number of occupancy records'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time of day'
                        }
                    }
                }
            }
        });
    }
});

// Real-time update of available spaces
document.addEventListener('DOMContentLoaded', function() {
    const updateAvailableSpaces = function() {
        fetch('/dashboard/available-spaces')
            .then(response => response.json())
            .then(data => {
                const spacesElement = document.querySelector('[data-available-spaces]');
                if (spacesElement) {
                    spacesElement.textContent = data.available + ' / ' + data.total;
                }
            })
            .catch(error => console.error('Error updating spaces:', error));
    };

    // Update immediately on page load
    updateAvailableSpaces();

    // Update every 10 seconds (adjust interval as needed)
    setInterval(updateAvailableSpaces, 10000);

    // Also update when user returns to the tab (if browser tab was inactive)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            updateAvailableSpaces();
        }
    });
});