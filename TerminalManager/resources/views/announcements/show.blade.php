@extends('layouts.app-sidebar')

@section('title', 'Announcement Details')

@section('content')
<div class="container py-4">
    <div class="card shadow-sm">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">
                <i class="mb-4 bi bi-megaphone-fill me-1 text-primary fs-4"></i>
                {{ $announcement->subject }}
            </h5>
            <a href="{{ route('announcements') }}" class="btn btn-sm btn-primary">
                <i class="bi bi-arrow-left"></i> Back
            </a>
        </div>

        <div class="card-body">
            <p>
                <strong>From:</strong>
                {{ $announcement->sender->name ?? 'System' }}
                @if ($announcement->sender && $announcement->sender->role)
                    <span class="badge bg-primary ms-1">
                        [{{ ucfirst($announcement->sender->role) }}]
                    </span>
                @endif
            </p>

            <p>
                <strong>To:</strong>
                @if ($announcement->recipient)
                    {{ $announcement->recipient->name }}
                    <span class="badge {{ $announcement->recipient->role === 'manager' ? 'bg-info text-dark' : 'bg-primary' }} ms-1">
                        [{{ ucfirst($announcement->recipient->role) }}]
                    </span>
                @else
                    <span class="badge bg-dark">[All Operators]</span>
                @endif
            </p>

            <p><strong>Sent At:</strong> {{ $announcement->created_at->timezone('Asia/Manila')->format('M d, Y h:i A') }}</p>

            <hr>

            <div class="announcement-body">
                <p>{{ $announcement->body }}</p>
            </div>
        </div>
    </div>
</div>
@endsection
