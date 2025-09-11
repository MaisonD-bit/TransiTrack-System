@extends('layouts.app')

@section('content')

<div class="container py-4">
    <h1 class="mb-4">All Buses</h1>
    
    @if(session('success'))
    <div class="alert alert-success">{{ session('success') }}</div>
    @endif

    <div class="mb-3 text-end">
        <a href="{{ route('bus.create') }}" class="btn btn-success">+ Add New Bus</a>
    </div>

    <div class="card">
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-striped table-hover mb-0">
                    <thead class="table-light sticky-top">
                        <tr>
                            <th>Bus ID</th>
                            <th>Plate</th>
                            <th>Number</th>
                            <th>Company</th>
                            <th>Model</th>
                            <th>Accommodation</th>
                            <th>Status</th>
                            <th>Capacity</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($buses as $bus)
                        <tr>
                            <td>{{ $bus->id }}</td>
                            <td>{{ $bus->plate_number }}</td>
                            <td>{{ $bus->bus_number }}</td>
                            <td>{{ $bus->bus_company }}</td>
                            <td>{{ $bus->model }}</td>
                            <td>{{ ucfirst($bus->accommodation_type) }}</td>
                            <td>{{ ucfirst($bus->status) }}</td>
                            <td>{{ $bus->capacity }}</td>
                            <td class="d-flex gap-1">
                                <a href="{{ route('bus.edit', $bus->id) }}" class="btn btn-warning btn-sm">Edit</a>
                                <form action="{{ route('bus.destroy', $bus->id) }}" method="POST" onsubmit="return confirm('Are you sure?');">
                                    @csrf
                                    @method('DELETE')
                                    <button class="btn btn-danger btn-sm">Delete</button>
                                </form>
                            </td>
                        </tr>
                        @empty
                        <tr>
                            <td colspan="9" class="text-center text-muted">No buses found.</td>
                        </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    ```

</div>
@endsection