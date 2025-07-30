@extends('layouts.app')

@section('content')
<div class="container py-4">
    <h1 class="mb-4">All Spaces</h1>

    @if(session('success'))
        <div class="alert alert-success">{{ session('success') }}</div>
    @endif

    <a href="{{ route('drivers.create') }}" class="btn btn-primary mb-3"> Add New Space </a>

    <div class="card">
        <div class="card-body p-0">
            <table class="table table-hover mb-0">
                <thead class="thead-light">
                    <tr>
                        <th>Driver ID</th>
                        <th>License Number</th>
                        <th>Contact Info</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($drivers as $driver)
                        <tr>
                            <td>{{ $driver->driver_id }}</td>
                            <td>{{ $driver->license_number }}</td>
                            <td>{{ $driver->contact_info }}</td>
                            <td>
                                <a href="{{ route('drivers.show', $driver->driver_id) }}" class="btn btn-info btn-sm">View</a>
                                <a href="{{ route('drivers.edit', $driver->driver_id) }}" class="btn btn-warning btn-sm">Edit</a>
                                <form action="{{ route('drivers.destroy', $driver->driver_id) }}" method="POST" class="d-inline">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" onclick="return confirm('Do you want to delete this driver?');" class="btn btn-danger btn-sm">Delete</button>
                                </form>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="4" class="text-center text-muted">
                                No spaces found.
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </div>
</div>
@endsection
