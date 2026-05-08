@extends('layouts.app-sidebar')

@section('content')
<div class="container py-4">
    <div class="row g-4">

        <!-- Left: Announcements History -->
        <div class="col-md-7">
            <div class="card shadow-sm h-100">
                <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                    <h5 class="mb-0"><i class="bi bi-megaphone-fill"></i> Announcements</h5>
                </div>
                <div class="card-body p-0" style="max-height: 500px; overflow-y: auto;">
                    @if($messages->isEmpty())
                    <div class="text-center py-5 text-muted">
                        <i class="fa-solid fa-megaphone fs-1"></i>
                        <p class="mt-2">No announcements yet</p>
                    </div>
                    @else
                    <ul class="list-group list-group-flush">
                        @foreach($messages as $message)
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="fw-bold mb-1">{{ $message->subject }}</h6>
                                <small class="text-muted">
                                    Announced by:
                                    {{ $message->sender->name ?? 'System' }}
                                    @if($message->sender && $message->sender->role)
                                    <span class="badge bg-primary ms-1">[{{ ucfirst($message->sender->role) }}]</span>
                                    @endif
                                </small><br>
                                <small class="text-muted">
                                    Sent to:
                                    @if($message->recipient_type === 'operators')
                                    <span class="badge bg-success">All Operators</span>
                                    @elseif($message->recipient_type === 'managers')
                                    <span class="badge bg-info text-dark">All Managers</span>
                                    @else
                                    <span class="badge bg-success">All Operators</span>
                                    <span class="badge bg-info text-dark ms-1">All Managers</span>
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

        <!-- Right: Create Announcement -->
        <div class="col-md-5">
            <div class="card shadow-sm">
                <div class="card-header bg-primary text-white">
                    <i class="bi bi-megaphone-fill"></i> Create Announcement
                </div>
                <div class="card-body">
                    <form action="{{ route('messages.store') }}" method="POST">
                        @csrf

                        <div class="mb-3">
                            <label class="form-label fw-bold">Send To</label>
                            <select name="recipient_type" class="form-select" required>
                                <option value="">-- Select Recipients --</option>
                                <option value="operators">All Operators</option>
                                <option value="managers">All Managers</option>
                                <option value="all">All Managers and Operators</option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label class="form-label fw-bold">Subject</label>
                            <input type="text" name="subject" class="form-control" required>
                        </div>

                        <div class="mb-3">
                            <label class="form-label fw-bold">Announcement</label>
                            <textarea name="body" rows="4" class="form-control" required></textarea>
                        </div>

                        <button type="submit" class="btn btn-primary w-100 fw-bold">
                            <i class="bi bi-megaphone-fill"></i> Send Announcement
                        </button>
                    </form>
                </div>
            </div>
        </div>

    </div>
</div>
@endsection