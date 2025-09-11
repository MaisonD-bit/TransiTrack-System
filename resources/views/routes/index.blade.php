@extends('layouts.app')

@section('content')
<div class="container py-4">
    <h1 class="mb-4">All Routes</h1>

    @if(session('success'))
        <div class="alert alert-success">{{ session('success') }}</div>
    @endif

    <a href="{{ route('routes.create') }}" class="btn btn-primary mb-3">Add New Route</a>

    <div class="card">
        <div class="card-body p-0">
            <table class="table table-hover mb-0">
                <thead class="thead-light">
                    <tr>
                        <th>ID</th>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Regular</th>
                        <th>Aircon</th>
                        <th>Distance (km)</th>
                        <th>Duration (min)</th>
                        <th>Status</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($routes as $route)
                        <tr>
                            <td>{{ $route->id }}</td>
                            <td>{{ $route->code }}</td>
                            <td>{{ $route->name }}</td>
                            <td>{{ $route->start_location }}</td>
                            <td>{{ $route->end_location }}</td>
                            <td>{{ number_format($route->regular_price, 2) }}</td>
                            <td>{{ number_format($route->aircon_price, 2) }}</td>
                            <td>{{ $route->distance_km }}</td>
                            <td>{{ $route->estimated_duration }}</td>
                            <td>
                                <span class="badge bg-{{ $route->status === 'active' ? 'success' : 'secondary' }}">
                                    {{ ucfirst($route->status) }}
                                </span>
                            </td>
                            <td>{{ \Illuminate\Support\Str::limit($route->description, 30) }}</td>
                            <td class="d-flex gap-1">
                                <a href="{{ route('routes.edit', $route->id) }}" class="btn btn-warning btn-sm">Edit</a>
                                <form action="{{ route('routes.destroy', $route->id) }}" method="POST" onsubmit="return confirm('Do you want to delete this route?');">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="btn btn-danger btn-sm">Delete</button>
                                </form>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="12" class="text-center text-muted">No routes found.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
</div>
@endsection
