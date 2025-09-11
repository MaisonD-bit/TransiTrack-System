@extends('layouts.app')

@section('content')
<div class="container py-4 justify-content-center">
    @if(session('success'))
        <div class="alert alert-success">{{ session('success') }}</div>
    @endif

    <div class="d-flex align-items-center">
        <i class="mb-4 bi bi-chat-dots-fill me-3 text-primary fs-4"></i>
        <h1 class="mb-4 fw-bold" style="font-size:2rem;">Messages</h1>
    </div>

    <div class="card mb-4">
        <div class="card-header bg-primary text-white">
            <i class="bi bi-envelope-plus"></i> Send a new message:
        </div>

        <div class="card-body">
            <form action="{{ route('messages.store') }}" method="POST">
                @csrf

                <div class="mb-3">
                    <label for="recipient_id" class="form-label fw-bold">Recipient</label>
                    <select name="recipient_id" id="recipient_id" class="form-select">
                        <option value="">Send to All Operators</option>
                        @foreach($users as $user)
                            <option value="{{ $user->id }}">{{ $user->name }} ({{ ucfirst($user->role) }})</option>
                        @endforeach
                    </select>
                </div>

                <div class="mb-3">
                    <label for="subject" class="form-label fw-bold">Subject</label>
                    <input type="text" name="subject" id="subject" class="form-control" required>
                </div>

                <div class="mb-3">
                    <label for="body" class="form-label fw-bold">Message</label>
                    <textarea name="body" id="body" rows="4" class="form-control" required></textarea>
                </div>

                <button type="submit" class="btn btn-primary"><i class="bi bi-send"></i> Send</button>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card-header bg-primary text-white">
            <i class="bi bi-clock-history"></i> Message History
        </div>
        <div class="card-body">
            @if($messages->isEmpty())
            <div class="text-center py-3">
                <i class="fa-solid fa-comment-slash fa-3x"></i>
            </div>
            <div class="text-center">
                <h4>No messages found</h4>
            </div>
                
            @else
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Subject</th>
                            <th>Sender</th>
                            <th>Recipient</th>
                            <th>Status</th>
                            <th>Sent At</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($messages as $message)
                            <tr>
                                <td>{{ $message->subject }}</td>
                                <td>{{ $message->sender->name ?? 'Unknown' }}</td>
                                <td>
                                    {{ $message->recipient ? $message->recipient->name : 'All Operators' }}
                                </td>
                                <td>
                                    <span class="badge bg-{{ $message->status == 'unread' ? 'warning' : 'success' }}">
                                        {{ ucfirst($message->status) }}
                                    </span>
                                </td>
                                <td>{{ $message->created_at->format('Y-m-d H:i') }}</td>
                                <td>
                                    <a href="{{ route('messages.show', $message->id) }}" class="btn btn-sm btn-info">View</a>
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            @endif
        </div>
    </div>
</div>
@endsection
