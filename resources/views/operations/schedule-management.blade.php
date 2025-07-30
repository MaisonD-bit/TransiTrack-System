@extends('layouts.app')

@section('content')
<style>
.card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    background: white;
    padding: 1rem;
    margin-bottom: 1rem;
}
</style>

<div class="container py-4 justify-content-center">
    <h1 class="mb-4 fw-bold" style="font-size:2rem;">Bus Schedules</h1>

    <div class="card">
        <table class="table table-hover align-middle mb-0">
            <thead>
                <tr>
                    <th scope="col">BUS</th>
                    <th scope="col">DRIVER</th>
                    <th scope="col">ROUTE</th>
                    <th scope="col">DEPARTURE</th>
                    <th scope="col">ARRIVAL</th>
                </tr>
            </thead>
            <tbody>
                @forelse($schedules as $schedule)
                    <tr>
                        <td>{{ $schedule->bus->bus_id ?? '-' }}</td>
                        <td>{{ $schedule->driver->name ?? '-' }}</td>
                        <td>{{ $schedule->route->name ?? '-' }}</td>
                        <td>
                            {{ $schedule->date }}<br>
                            <span class="text-primary">{{ $schedule->departure_time }}</span>
                        </td>
                        <td>
                            {{ $schedule->date }}<br>
                            <span class="text-success">{{ $schedule->arrival_time }}</span>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" class="text-center text-muted">No schedules found.</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>
</div>
@endsection