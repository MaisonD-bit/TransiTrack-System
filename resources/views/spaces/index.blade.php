@extends('layouts.app')

@section('content')
<div class="container py-4">
    <h1 class="mb-4">All Spaces</h1>

    @if(session('success'))
        <div class="alert alert-success">{{ session('success') }}</div>
    @endif

    <a href="{{ route('spaces.create') }}" class="btn btn-primary mb-3"> Add New Space </a>

    <div class="card">
        <div class="card-body p-0">
            <table class="table table-hover mb-0">
                <thead class="thead-light">
                    <tr>
                        <th>ID</th>
                        <th>Location</th>
                        <th>Is Occupied?</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse($spaces as $space)
                        <tr>
                            <td>{{ $space->space_id }}</td>
                            <td>{{ $space->location }}</td>
                            <td>
                                @if($space->is_occupied)
                                    <span class="badge bg-danger">Yes</span>
                                @else
                                    <span class="badge bg-success">No</span>
                                @endif
                            </td>
                            <td>
                                <a href="{{ route('spaces.show', $space->space_id) }}" class="btn btn-info btn-sm">View</a>
                                <a href="{{ route('spaces.edit', $space->space_id) }}" class="btn btn-warning btn-sm">Edit</a>
                                <form action="{{ route('spaces.destroy', $space->space_id) }}" method="POST" class="d-inline">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" onclick="return confirm('Do you want to delete this space?');" class="btn btn-danger btn-sm">Delete</button>
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
