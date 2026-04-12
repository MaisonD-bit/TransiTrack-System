@extends('layouts.app-sidebar')

@section ('title', 'Bus Schedules')

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
</style>

<div class="container py-4 justify-content-center">

    <div class="d-flex align-items-center">
        <i class="mb-4 fas fa-calendar-alt me-3 text-primary fs-4"></i>
        <h1 class="mb-4 fw-bold" style="font-size:2rem;">Bus Schedules</h1>
    </div>

    <form method="GET" action="{{ route('bus-schedule') }}" class="row mb-4 g-2">
        <div class="col-md-12 mb-3">
            <div class="input-group rounded">
                <span class="input-group-text bg-transparent border-0" id="search-addon">
                    <i class="bi bi-search"></i>
                    
                </span>
                <input type="text" name="search" value="{{ request('search') }}" class="form-control" placeholder="Search" style="border-color: #999; border-radius: 50px; outline: none;">
            </div>
        </div>

        <div class="col-md-3">
            <input type="date" name="date" value="{{ request('date') }}" class="form-control" placeholder="Date">
        </div>
        <div class="col-md-2">
            <select name="status" class="form-control">
                <option value="">All Statuses</option>
                @foreach($statuses as $status)
                <option value="{{ $status }}" {{ request('status') == $status ? 'selected' : '' }}>
                    {{ ucfirst($status) }}
                </option>
                @endforeach
            </select>
        </div>
        <div class="col-md-3">
            <select name="driver_id" class="form-control">
                <option value="">All Drivers</option>
                @foreach($drivers as $driver)
                <option value="{{ $driver->id }}" {{ request('driver_id') == $driver->id ? 'selected' : '' }}>
                    {{ $driver->name }}
                </option>
                @endforeach
            </select>
        </div>
        <div class="col-md-3">
            <select name="route_id" class="form-control">
                <option value="">All Routes</option>
                @foreach($routes as $route)
                <option value="{{ $route->id }}" {{ request('route_id') == $route->id ? 'selected' : '' }}>
                    {{ $route->name }}
                </option>
                @endforeach
            </select>
        </div>
        <div class="col-md-1">
            <button type="submit" class="btn btn-primary w-100">Filter</button>
        </div>
    </form>

    {{-- Table --}}
    <div class="card border-0 shadow-sm">
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
    
    <div class="mt-3">
        {{ $busSchedules->links() }}
    </div>
</div>
@endsection