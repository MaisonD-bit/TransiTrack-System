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

</style>

<div class="container py-4 justify-content-center">

    <div class="d-flex align-items-center">
        <i class="mb-4 fas fa-calendar-alt me-3 text-primary fs-4"></i>
        <h1 class="mb-4 fw-bold" style="font-size:2rem;">Bus Schedules</h1>
    </div>

    <form method="GET" action="{{ route('schedule-management') }}" class="row mb-4 g-2">
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
        <div class="col-md-3">
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
            <button type="submit" class="btn btn-primary w-100">Filter</button>
        </div>
    </form>

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