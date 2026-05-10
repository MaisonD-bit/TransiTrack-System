@extends('layouts.app-sidebar')

@section('content')
<div class="container py-4">
    <div class="card shadow-sm border-warning">
        <div class="card-header bg-warning bg-opacity-10 d-flex justify-content-between align-items-center">
            <h5 class="mb-0">
                <i class="bi bi-megaphone-fill me-2 text-warning fs-4"></i>
                Announcement: {{ $message->subject }}
            </h5>
            <a href="{{ route('messages') }}" class="btn btn-sm btn-primary">
                <i class="bi bi-arrow-left"></i> Back
            </a>
        </div>

        <div class="card-body">
            <p>
                <strong>Recipient(s):</strong>
                @if ($message->recipient)
                <span class="badge bg-info text-dark">{{ ucfirst($message->recipient->role) }}</span>
                @else
                <span class="badge bg-success">All Operators</span>
                <span class="badge bg-primary ms-1">All Managers</span>
                @endif
            </p>

            <p><strong>Announced On:</strong> {{ $message->created_at->format('M d, Y h:i A') }}</p>

            <hr>

            <div class="announcement-body">
                <p>{{ $message->body }}</p>
            </div>
        </div>
    </div>
</div>
@endsection