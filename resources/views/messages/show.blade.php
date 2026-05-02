@extends('layouts.app-sidebar')

@section('content')
<div class="container py-4">
    <div class="card shadow-sm">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">
                <i class="mb-4 bi bi-chat-dots-fill me-1 text-primary fs-4"></i> 
                {{ $message->subject }}
            </h5>
            <a href="{{ route('messages') }}" class="btn btn-sm btn-primary">
                <i class="bi bi-arrow-left"></i> Back
            </a>
        </div>

        <div class="card-body">
            <p>
                <strong>From:</strong> 
                {{ $message->sender->name ?? 'System' }}
                @if ($message->sender && $message->sender->role)
                    <span class="badge 
                        {{ $message->sender->role === 'manager' ? 'bg-primary' : 'bg-primary' }} ms-1">
                        [{{ ucfirst($message->sender->role) }}]
                    </span>
                @endif
            </p>

            <p>
                <strong>To:</strong>
                @if ($message->recipient)
                    {{ $message->recipient->name }}
                    <span class="badge 
                        {{ $message->recipient->role === 'manager' ? 'bg-info text-dark' : 'bg-primary' }} ms-1">
                        [{{ ucfirst($message->recipient->role) }}]
                    </span>
                @else
                    <span class="badge bg-dark">[All Operators]</span>
                @endif
            </p>

            <p><strong>Sent At:</strong> {{ $message->created_at->format('M d, Y h:i A') }}</p>

            <hr>

            <div class="message-body">
                <p>{{ $message->body }}</p>
            </div>
        </div>
    </div>
</div>
@endsection
