@extends('layouts.app')

@section('content')
<style>

    .card {
        border-radius: 8px;
        background: white;
        padding: 1rem;
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

        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
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

    .icon-blue { background: #2b7be4; color: #ffffffff; }
    .icon-green { background: #1bb76e; color: #ffffffff; }
    .icon-yellow { background: #e6b800; color: #ffffffff; }
    .icon-purple { background: #a259e6; color: #ffffffff; }
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
    
</style>

<div class="container py-4">

    <div class="d-flex align-items-center">
        <i class="mb-4 bi bi-speedometer2 me-3 text-primary fs-4"></i>
        <h1 class="mb-4 fw-bold" style="font-size:2rem;">Dashboard Overview</h1>
    </div>

    <div class="row g-3 justify-content-center">

        <!-- Total Schdules -->
        <div class="col-12 col-sm-6 col-md-3">
            <div class="dashboard-card">
                <div class="dashboard-icon icon-yellow">
                    <i class="bi bi-calendar2-week"></i>
                </div>
                <div>
                    <div class="dashboard-label">Total Schedules</div>
                    <div class="dashboard-value">{{ $stats['total_schedules'] }}</div>
                </div>
            </div>
        </div>

        <!-- Active Buses -->
        <div class="col-12 col-sm-6 col-md-3">
            <div class="dashboard-card">
                <div class="dashboard-icon icon-blue">
                    <i class="bi bi-bus-front"></i>
                </div>
                <div>
                    <div class="dashboard-label">Active Buses</div>
                    <div class="dashboard-value">{{ $stats['active_busses'] }}</div>
                </div>
            </div>
        </div>

        <!-- Available Spaces -->
        <div class="col-12 col-sm-6 col-md-3">
            <div class="dashboard-card">
                <div class="dashboard-icon icon-green">
                    <i class="bi bi-p-circle-fill"></i>
                </div>
                <div>
                    <div class="dashboard-label">Available Spaces</div>
                    <div class="dashboard-value">{{ $stats['available_spaces'] }} / {{ $stats['total_spaces'] }}</div>
                </div>
            </div>
        </div>

        <!-- New Messages -->
        <div class="col-12 col-sm-6 col-md-3">
            <div class="dashboard-card">
                <div class="dashboard-icon icon-purple">
                    <i class="bi bi-envelope-fill"></i>
                </div>
                <div>
                    <div class="dashboard-label">New Messages</div>
                    <div class="dashboard-value">{{ $stats['new_messages'] }}</div>
                </div>
            </div>
        </div>
    </div>

    <div class="container py-4 justify-content-center">

    <div class="d-flex align-items-center">
        <i class="mb-4 fas fa-calendar-alt me-3 text-primary fs-4"></i>
        <h1 class="mb-4 fw-bold" style="font-size:2rem;">Bus Schedules</h1>
    </div>

    {{-- Table --}}
    <div class="card">
        <table class="table table-hover align-middle mb-0">
            <thead>
                <tr>
                    <th>SCHEDULE ID</th>
                    <th>BUS</th>
                    <th>DRIVER</th>
                    <th>ROUTE</th>
                    <th>DEPARTURE</th>
                    <th>ARRIVAL</th>
                    <th>STATUS</th>
                    <th>DATE</th>
                </tr>
            </thead>
            <tbody>
                @forelse($busSchedules as $busSchedule)
                <tr>
                    <td>{{ $busSchedule->id }}</td>
                    <td>{{ $busSchedule->bus->plate_number ?? '-' }}</td>
                    <td>{{ $busSchedule->driver->name ?? '-' }}</td>
                    <td>{{ $busSchedule->route->name ?? '-' }}</td>
                    <td>
                        {{ $busSchedule->date->format('Y-m-d') }}<br>
                        <span class="text-primary">{{ $busSchedule->start_time }}</span>
                    </td>
                    <td>
                        {{ $busSchedule->date->format('Y-m-d') }}<br>
                        <span class="text-success">{{ $busSchedule->end_time }}</span>
                    </td>
                    <td>{{ ucfirst(str_replace('_', ' ', $busSchedule->status)) }}</td>
                    <td>{{ $busSchedule->date->format('F d, Y') }}</td>
                </tr>
                @empty
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        <div class="text-center py-3">
                            <i class="fas fa-calendar-times fa-3x text-muted"></i>
                        </div>
                        <h4>No schedules found</h4>
                    </td>
                </tr>
                @endforelse
            </tbody>
        </table>
    </div>
    
    <div class="mt-3">
        {{ $busSchedules->links() }}
    </div>

</div>
@endsection
