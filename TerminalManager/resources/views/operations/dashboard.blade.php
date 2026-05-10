@extends('layouts.app-sidebar')

@section ('title', 'Manager Dashboard')

@section('content')
<style>
    .card {
        border-radius: 8px;
        background: white;
        margin-bottom: 1rem;
    }

    .input-group.rounded {
        padding: 0.25rem 1rem;
        border: transparent;
        overflow: hidden;
    }

    .input-group.rounded input::placeholder {
        color: #999;
        font-style: italic;
    }

    .dashboard-card {
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        background: #fff;
        padding: 1.5rem 1rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
        min-width: 220px;
        text-align: center;
    }

    .dashboard-icon {
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-size: 2rem;
        flex-shrink: 0;
        margin-bottom: 0.5rem;
    }

    .icon-blue {
        background: #2b7be4;
        color: #ffffffff;
    }

    .icon-green {
        background: #1bb76e;
        color: #ffffffff;
    }

    .icon-yellow {
        background: #e6b800;
        color: #ffffffff;
    }

    .icon-purple {
        background: #a259e6;
        color: #ffffffff;
    }

    .dashboard-label {
        font-size: 1rem;
        color: #444;
        margin-bottom: 0.5rem;
    }

    .dashboard-value {
        font-size: 1.5rem;
        font-weight: bold;
        letter-spacing: 1px;
    }

    .clickable-card {
        text-decoration: none;
        color: inherit;
    }

    .border-indigo {
        border: 1px solid #a259e6 !important;
    }
</style>

<div class="container py-4">

    <div class="d-flex align-items-center">
        <i class="mb-4 fas fa-tachometer-alt me-3 text-primary fs-4"></i>
        <h1 class="mb-4 fw-bold" style="font-size:2rem;">Overview</h1>
    </div>

    <div class="row g-3 justify-content-center">

        <!-- Total Schdules -->
        <div class="col-12 col-sm-6 col-md-3">
            <a href="{{ route('bus-schedule') }}" class="clickable-card">
                <div class="card border-warning dashboard-card">
                    <div class="dashboard-icon icon-yellow">
                        <i class="bi bi-calendar2-week"></i>
                    </div>
                    <div>
                        <div class="dashboard-label">Total Schedules</div>
                        <div class="dashboard-value">{{ $stats['total_schedules'] }}</div>
                    </div>
                </div>
            </a>
        </div>

        <!-- Active Buses -->
        <div class="col-12 col-sm-6 col-md-3">
            <a href="{{ route('bus-schedule') }}" class="clickable-card">
                <div class="card border-primary dashboard-card">
                    <div class="dashboard-icon icon-blue">
                        <i class="bi bi-bus-front"></i>
                    </div>
                    <div>
                        <div class="dashboard-label">Active Buses</div>
                        <div class="dashboard-value">{{ $stats['active_busses'] }}</div>
                    </div>
                </div>
            </a>
        </div>

        <!-- Available Spaces -->
        <div class="col-12 col-sm-6 col-md-3">
            <a href="#" class="clickable-card">
                <div class="card border-success dashboard-card">
                    <div class="dashboard-icon icon-green">
                        <i class="bi bi-p-circle-fill"></i>
                    </div>
                    <div>
                        <div class="dashboard-label">Available Spaces</div>
                        <div class="dashboard-value" data-available-spaces>{{ $stats['available_spaces'] }} / {{ $stats['total_spaces'] }}</div>
                    </div>
                </div>
            </a>
        </div>

        <!-- Chat Messages -->
        <div class="col-12 col-sm-6 col-md-3">
            <a href="{{ route('chat') }}" class="clickable-card">
                <div class="card border-indigo dashboard-card">
                    <div class="dashboard-icon icon-purple">
                        <i class="bi bi-envelope-fill"></i>
                    </div>
                    <div>
                        <div class="dashboard-label">New Messages</div>
                        <div class="dashboard-value">{{ $stats['new_messages'] }}</div>
                    </div>
                </div>
            </a>
        </div>
    </div>

    <div class="container py-4 justify-content-center">

        <div class="d-flex align-items-center">
            <i class="mb-4 fas fa-calendar-alt me-3 text-primary fs-4"></i>
            <h1 class="mb-4 fw-bold" style="font-size:2rem;">Recent Bus Schedules</h1>
        </div>

        {{-- Table --}}
        <div class="card border-0 shadow-sm">
            <div class="card-header bg-light d-flex justify-content-between align-items-center">
                <h5 class="mb-0"><i class="fas fa-calendar-alt me-2"></i>Recent Schedules</h5>
            </div>
            <div class="card-body">
                @if($busSchedules->count() > 0)
                <div class="table-responsive">
                    <table class="table table-hover align-middle" id="schedulesTable">
                        <thead class="table-light">
                            <tr>
                                <th>Route</th>
                                <th>Driver</th>
                                <th>Bus</th>
                                <th>Departure</th>
                                <th>Arrival</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($busSchedules as $schedule)
                            <tr>
                                <td>
                                    <div class="d-flex align-items-center">
                                        <div class="bg-primary bg-opacity-10 rounded-circle me-2 d-flex align-items-center justify-content-center" style="width: 30px; height: 30px;">
                                            <i class="fas fa-route text-primary"></i>
                                        </div>
                                        <div>
                                            <div class="fw-bold">{{ $schedule->route->name ?? 'N/A' }}</div>
                                            <small class="text-muted">{{ $schedule->route->code ?? 'N/A' }}</small>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div class="d-flex align-items-center">
                                        <div class="bg-info bg-opacity-10 rounded-circle me-2 d-flex align-items-center justify-content-center" style="width: 30px; height: 30px;">
                                            <i class="fas fa-user text-info"></i>
                                        </div>
                                        {{ $schedule->driver->name ?? 'N/A' }}
                                    </div>
                                </td>
                                <td>
                                    <div class="d-flex align-items-center">
                                        <div class="bg-success bg-opacity-10 rounded-circle me-2 d-flex align-items-center justify-content-center" style="width: 30px; height: 30px;">
                                            <i class="fas fa-bus text-success"></i>
                                        </div>
                                        <div>
                                            <span class="fw-semibold">{{ $schedule->bus->plate_number ?? 'N/A' }}</span>
                                            <br><small class="text-muted">{{ $schedule->bus->model ?? 'N/A' }}</small>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div>
                                        <div class="fw-semibold">{{ \Carbon\Carbon::parse($schedule->date)->format('Y-m-d') }}</div>
                                        <small class="text-primary">{{ $schedule->start_time }}</small>
                                    </div>
                                </td>
                                <td>
                                    <div>
                                        <div class="fw-semibold">{{ \Carbon\Carbon::parse($schedule->date)->format('Y-m-d') }}</div>
                                        <small class="text-success">{{ $schedule->end_time }}</small>
                                    </div>
                                </td>
                                <td>
                                    @switch($schedule->status)
                                    @case('active')
                                    <span class="badge bg-success">
                                        <i class="fas fa-play me-1"></i>Active
                                    </span>
                                    @break
                                    @case('scheduled')
                                    <span class="badge bg-primary">
                                        <i class="fas fa-clock me-1"></i>Scheduled
                                    </span>
                                    @break
                                    @case('completed')
                                    <span class="badge bg-secondary">
                                        <i class="fas fa-check me-1"></i>Completed
                                    </span>
                                    @break
                                    @case('cancelled')
                                    <span class="badge bg-danger">
                                        <i class="fas fa-times me-1"></i>Cancelled
                                    </span>
                                    @break
                                    @default
                                    <span class="badge bg-secondary">{{ ucfirst($schedule->status) }}</span>
                                    @endswitch
                                </td>
                                <td>
                                    <span class="fw-semibold">{{ \Carbon\Carbon::parse($schedule->date)->format('M d, Y') }}</span>
                                    <br><small class="text-muted">{{ \Carbon\Carbon::parse($schedule->date)->format('l') }}</small>
                                </td>
                            </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
                @else
                <div class="text-center py-5">
                    <i class="fas fa-calendar-times fa-3x text-muted mb-3"></i>
                    <h4 class="text-muted">No Schedules Yet</h4>
                    <p class="text-muted">No bus schedules available at this moment.</p>
                </div>
                @endif
            </div>
        </div>

        <!-- Analytics Section -->
        <div class="mt-5">
            <div class="d-flex align-items-center">
                <i class="mb-4 fas fa-chart-pie me-3 text-primary fs-4"></i>
                <h1 class="mb-4 fw-bold" style="font-size:2rem;">Analytics</h1>
            </div>

            <div class="row g-3">
                <!-- Schedule Status Distribution -->
                <div class="col-12 col-lg-6">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-header bg-light">
                            <h5 class="mb-0"><i class="fas fa-pie-chart me-2"></i>Schedule Status Distribution</h5>
                        </div>
                        <div class="card-body d-flex justify-content-center align-items-center" style="min-height: 350px;">
                            <canvas id="scheduleStatusChart" style="max-height: 300px; max-width: 300px;"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Bus Utilization -->
                <div class="col-12 col-lg-6">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-header bg-light">
                            <h5 class="mb-0"><i class="fas fa-bus me-2"></i>Bus Utilization Metrics</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-4">
                                <div class="d-flex justify-content-between mb-2">
                                    <span class="fw-semibold">Fleet Utilization</span>
                                    <span class="fw-bold text-primary">{{ $analytics['bus_utilization'] }}%</span>
                                </div>
                                <div class="progress" style="height: 25px;">
                                    <div class="progress-bar bg-primary" role="progressbar" style="width: {{ $analytics['bus_utilization'] }}%;" aria-valuenow="{{ $analytics['bus_utilization'] }}" aria-valuemin="0" aria-valuemax="100">
                                        <small class="fw-bold">{{ $analytics['bus_utilization'] }}%</small>
                                    </div>
                                </div>
                            </div>

                            <div class="row text-center mt-4">
                                <div class="col-6 mb-3">
                                    <div class="p-3 bg-light rounded">
                                        <div class="fs-4 fw-bold text-success">{{ $analytics['buses_in_service'] }}</div>
                                        <small class="text-muted">Buses In Service</small>
                                    </div>
                                </div>
                                <div class="col-6 mb-3">
                                    <div class="p-3 bg-light rounded">
                                        <div class="fs-4 fw-bold text-secondary">{{ $analytics['total_buses'] }}</div>
                                        <small class="text-muted">Total Fleet</small>
                                    </div>
                                </div>
                            </div>

                            <!-- Schedule Status Stats -->
                            <div class="mt-4 pt-3 border-top">
                                <h6 class="mb-3"><i class="fas fa-tasks me-2"></i>Schedule Summary</h6>
                                <div class="row g-2">
                                    <div class="col-6 col-md-6">
                                        <div class="d-flex align-items-center">
                                            <div class="bg-success bg-opacity-10 rounded p-2 me-2">
                                                <i class="fas fa-check text-success"></i>
                                            </div>
                                            <div>
                                                <div class="fw-bold">{{ $analytics['status_counts']['completed'] ?? 0 }}</div>
                                                <small class="text-muted">Completed</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-6">
                                        <div class="d-flex align-items-center">
                                            <div class="bg-primary bg-opacity-10 rounded p-2 me-2">
                                                <i class="fas fa-play text-primary"></i>
                                            </div>
                                            <div>
                                                <div class="fw-bold">{{ $analytics['status_counts']['active'] ?? 0 }}</div>
                                                <small class="text-muted">Active</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-6">
                                        <div class="d-flex align-items-center">
                                            <div class="bg-warning bg-opacity-10 rounded p-2 me-2">
                                                <i class="fas fa-clock text-warning"></i>
                                            </div>
                                            <div>
                                                <div class="fw-bold">{{ $analytics['status_counts']['scheduled'] ?? 0 }}</div>
                                                <small class="text-muted">Scheduled</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-6 col-md-6">
                                        <div class="d-flex align-items-center">
                                            <div class="bg-danger bg-opacity-10 rounded p-2 me-2">
                                                <i class="fas fa-times text-danger"></i>
                                            </div>
                                            <div>
                                                <div class="fw-bold">{{ $analytics['status_counts']['cancelled'] ?? 0 }}</div>
                                                <small class="text-muted">Cancelled</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Space Utilization -->
                <div class="col-12 col-lg-6">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-header bg-light">
                            <h5 class="mb-0"><i class="fas fa-parking me-2"></i>Space Utilization</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-4">
                                <div class="d-flex justify-content-between mb-2">
                                    <span class="fw-semibold">Terminal Occupancy</span>
                                    <span class="fw-bold text-warning">{{ $analytics['space_utilization'] }}%</span>
                                </div>
                                <div class="progress" style="height: 25px;">
                                    <div class="progress-bar bg-warning" role="progressbar" style="width: {{ $analytics['space_utilization'] }}%;" aria-valuenow="{{ $analytics['space_utilization'] }}" aria-valuemin="0" aria-valuemax="100">
                                        <small class="fw-bold">{{ $analytics['space_utilization'] }}%</small>
                                    </div>
                                </div>
                            </div>

                            <div class="row text-center mt-4">
                                <div class="col-6 mb-3">
                                    <div class="p-3 bg-light rounded">
                                        <div class="fs-4 fw-bold text-success">{{ $analytics['available_spaces'] }}</div>
                                        <small class="text-muted">Available</small>
                                    </div>
                                </div>
                                <div class="col-6 mb-3">
                                    <div class="p-3 bg-light rounded">
                                        <div class="fs-4 fw-bold text-danger">{{ $analytics['occupied_spaces'] }}</div>
                                        <small class="text-muted">Occupied</small>
                                    </div>
                                </div>
                            </div>

                            <div class="mt-4 pt-3 border-top">
                                <h6 class="mb-3"><i class="fas fa-chart-bar me-2"></i>Space Statistics</h6>
                                <div class="row g-2">
                                    <div class="col-12">
                                        <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                                            <span class="text-muted">Total Spaces</span>
                                            <span class="fw-bold">{{ $analytics['total_spaces'] }}</span>
                                        </div>
                                    </div>
                                    <div class="col-12">
                                        <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                                            <span class="text-success">In Use</span>
                                            <span class="fw-bold text-success">{{ $analytics['occupied_spaces'] }} ({{ $analytics['space_utilization'] }}%)</span>
                                        </div>
                                    </div>
                                    <div class="col-12">
                                        <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded">
                                            <span class="text-info">Available</span>
                                            <span class="fw-bold text-info">{{ $analytics['available_spaces'] }} ({{ 100 - $analytics['space_utilization'] }}%)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        @endsection

        <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>
        <script>
            // Initialize Schedule Status Chart
            document.addEventListener('DOMContentLoaded', function() {
                const statusData = @json($analytics['status_counts'] ?? []);

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
            });

            // Real-time update of available spaces
            document.addEventListener('DOMContentLoaded', function() {
                const updateAvailableSpaces = function() {
                    fetch('{{ route("dashboard.available-spaces") }}')
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
        </script>