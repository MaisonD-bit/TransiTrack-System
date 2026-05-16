@extends('layouts.app')

@section('title', 'Manager Approvals')

@section('content')
<div class="container-fluid">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 class="mb-1 fw-bold">Terminal Manager approvals</h2>
            <p class="text-muted mb-0">Approve manager registrations so they can access Terminal Manager.</p>
        </div>
    </div>

    @if(session('success'))
    <div class="alert alert-success">{{ session('success') }}</div>
    @endif

    @if(session('error'))
    <div class="alert alert-danger">{{ session('error') }}</div>
    @endif

    <div class="row g-3 mb-4">
        <div class="col-md-3">
            <div class="card border-0 shadow-sm">
                <div class="card-body">
                    <div class="text-muted small">Pending</div>
                    <div class="h3 mb-0">{{ $counts['inactive'] }}</div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card border-0 shadow-sm">
                <div class="card-body">
                    <div class="text-muted small">Active</div>
                    <div class="h3 mb-0">{{ $counts['active'] }}</div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card border-0 shadow-sm">
                <div class="card-body">
                    <div class="text-muted small">Total</div>
                    <div class="h3 mb-0">{{ $counts['total'] }}</div>
                </div>
            </div>
        </div>
    </div>

    <div class="card border-0 shadow-sm">
        <div class="card-body">
            <div class="mb-3 d-flex gap-2 filter-buttons">
                <a href="{{ route('sysadmin.manager-approvals', ['status' => 'inactive']) }}"
                    class="btn btn-sm {{ $status === 'inactive' ? 'btn-warning' : 'btn-outline-warning' }}">
                    Pending
                </a>
                <a href="{{ route('sysadmin.manager-approvals', ['status' => 'active']) }}"
                    class="btn btn-sm {{ $status === 'active' ? 'btn-success' : 'btn-outline-success' }}">
                    Active
                </a>
                <a href="{{ route('sysadmin.manager-approvals', ['status' => 'all']) }}"
                    class="btn btn-sm {{ $status === 'all' ? 'btn-primary' : 'btn-outline-primary' }}">
                    All
                </a>
            </div>

            <div class="table-responsive">
                <table class="table align-middle">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Terminal</th>
                            <th>Status</th>
                            <th>Registered</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($managers as $manager)
                        <tr>
                            <td>{{ $manager->first_name }} {{ $manager->last_name }}</td>
                            <td>{{ $manager->email }}</td>
                            <td class="text-capitalize">{{ $manager->terminal ?? '-' }}</td>
                            <td>
                                @php
                                $badge = match($manager->status) {
                                'active' => 'bg-success',
                                default => 'bg-warning text-dark'
                                };
                                @endphp
                                <span class="badge {{ $badge }}">{{ ucfirst($manager->status) }}</span>
                            </td>
                            <td>{{ \Illuminate\Support\Carbon::parse($manager->created_at)->format('M d, Y h:i A') }}</td>
                            <td class="text-end">
                                @if($manager->status !== 'active')
                                <form action="{{ route('sysadmin.manager-approvals.approve', $manager->id) }}" method="POST" class="d-inline">
                                    @csrf
                                    <button type="submit" class="btn btn-sm btn-success">Approve</button>
                                </form>
                                @endif
                                @if($manager->status !== 'inactive')
                                <form action="{{ route('sysadmin.manager-approvals.deactivate', $manager->id) }}" method="POST" class="d-inline">
                                    @csrf
                                    <button type="submit" class="btn btn-sm btn-outline-danger">Set Inactive</button>
                                </form>
                                @endif
                            </td>
                        </tr>
                        @empty
                        <tr>
                            <td colspan="6" class="text-center text-muted py-4">No manager records found for this filter.</td>
                        </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
@endsection