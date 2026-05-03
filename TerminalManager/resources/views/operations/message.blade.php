@extends('layouts.app-sidebar')

@section('content')
<div class="container py-4">
    <div class="row g-4">

        <!-- Left: Message History -->
        <div class="col-md-7">
            <div class="card shadow-sm h-100">
                <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                    <h5 class="mb-0"><i class="bi bi-clock-history"></i> Message History</h5>
                </div>
                <div class="card-body p-0" style="max-height: 500px; overflow-y: auto;">
                    @if($messages->isEmpty())
                        <div class="text-center py-5 text-muted">
                            <i class="fa-solid fa-comment-slash fs-1"></i>
                            <p class="mt-2">No messages yet</p>
                        </div>
                    @else
                        <ul class="list-group list-group-flush">
                            @foreach($messages as $message)
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 class="fw-bold mb-1">{{ $message->subject }}</h6>
                                        <small class="text-muted">
                                            From: 
                                            {{ $message->sender->name ?? 'Unknown' }}
                                            @if($message->sender && $message->sender->role)
                                                <span class="badge bg-primary ms-1">[{{ ucfirst($message->sender->role) }}]</span>
                                            @endif

                                            →
                                            
                                            @if($message->recipient)
                                                {{ $message->recipient->name }}
                                                <span class="badge bg-primary ms-1">[{{ ucfirst($message->recipient->role) }}]</span>
                                            @else
                                                <span class="badge bg-dark ms-1">All Operators</span>
                                            @endif
                                        </small><br>
                                        <span class="badge bg-{{ $message->status == 'unread' ? 'warning' : 'success' }}">
                                            {{ ucfirst($message->status) }}
                                        </span>
                                    </div>
                                    <div class="text-end">
                                        <small class="text-muted d-block">{{ $message->created_at->format('M d, Y H:i') }}</small>
                                        <a href="{{ route('messages.show', $message->id) }}" 
                                           class="btn btn-sm btn-outline-primary mt-2">
                                           <i class="bi bi-eye"></i> View
                                        </a>
                                    </div>
                                </li>
                            @endforeach
                        </ul>
                    @endif
                </div>
            </div>
        </div>

        <!-- Right: New Message -->
        <div class="col-md-5">
            <div class="card shadow-sm">
                <div class="card-header bg-primary text-white">
                    <i class="bi bi-envelope-plus"></i> Send a New Message
                </div>
                <div class="card-body">
                    <form action="{{ route('messages.store') }}" method="POST">
                        @csrf

                        <div class="mb-3">
                            <label class="form-label fw-bold">Recipient</label>
                            <select name="recipient_id" class="form-select">
                                <option value="">Send to All Operators</option>
                                @foreach($users as $user)
                                    <option value="{{ $user->id }}">
                                        {{ $user->name }}
                                        @if($user->role === 'operator')
                                            [Operator]
                                        @elseif($user->role === 'manager')
                                            [Manager]
                                        @endif
                                    </option>
                                @endforeach
                            </select>
                        </div>

                        <div class="mb-3">
                            <label class="form-label fw-bold">Subject</label>
                            <input type="text" name="subject" class="form-control" required>
                        </div>

                        <div class="mb-3">
                            <label class="form-label fw-bold">Message</label>
                            <textarea name="body" rows="4" class="form-control" required></textarea>
                        </div>

                        <button type="submit" class="btn btn-primary w-100">
                            <i class="bi bi-send"></i> Send Message
                        </button>
                    </form>
                </div>
            </div>
        </div>

    </div>
</div>
@endsection
