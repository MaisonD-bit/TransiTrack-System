@extends('layouts.app-sidebar')

@section('title', 'Chat')

@section('content')
<style>
    .chat-member-picker {
        max-height: 220px;
        overflow-y: auto;
        border: 1px solid #dee2e6;
        border-radius: 0.375rem;
        padding: 0.5rem;
        background: #fff;
    }

    .chat-member-picker-item {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 0.45rem 0.5rem;
        margin: 0;
        border-radius: 0.35rem;
        cursor: pointer;
        user-select: none;
    }

    .chat-member-picker-item:hover {
        background: #f8f9fa;
    }

    .chat-member-picker-item .form-check-input {
        margin-top: 0.2rem;
        flex-shrink: 0;
    }

    .chat-member-picker-label {
        line-height: 1.35;
        font-size: 0.9rem;
    }

    .chat-member-picker-empty {
        padding: 0.35rem 0.25rem;
        font-size: 0.9rem;
    }

    #terminal-chat-page .col-md-9 > .card {
        min-width: 0;
    }

    #messages-container {
        overflow-x: hidden;
        overflow-wrap: anywhere;
    }

    .message-item {
        margin-bottom: 1rem;
        display: flex;
        align-items: flex-start;
        max-width: 100%;
        min-width: 0;
    }

    .message-item.own {
        flex-direction: row-reverse;
        align-items: flex-end;
        gap: 0.15rem;
        justify-content: flex-start;
    }

    .message-bubble {
        max-width: min(70%, 100%);
        min-width: 0;
        flex: 0 1 auto;
        padding: 0.75rem 1rem;
        border-radius: 1rem;
        position: relative;
        overflow-wrap: anywhere;
        word-break: break-word;
    }

    .message-item.own .message-bubble {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-bottom-right-radius: 0.25rem;
    }

    .message-item:not(.own) .message-bubble {
        background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        color: white;
        border-bottom-left-radius: 0.25rem;
        box-shadow: 0 2px 8px rgba(17, 153, 142, 0.2);
    }

    .message-item:not(.own) .message-attachment {
        background: rgba(255, 255, 255, 0.2);
    }

    .message-item:not(.own) .message-attachment a,
    .message-item:not(.own) .message-link a {
        color: inherit;
    }

    .message-author {
        font-weight: 600;
        font-size: 0.85rem;
        margin-bottom: 0.25rem;
    }

    .message-text {
        margin: 0;
        overflow-wrap: anywhere;
        word-break: break-word;
        white-space: pre-wrap;
    }

    .message-time {
        font-size: 0.75rem;
        opacity: 0.7;
        margin-top: 0.25rem;
    }

    .message-bubble {
        position: relative;
    }

    .message-menu {
        position: relative;
        flex-shrink: 0;
        align-self: center;
    }

    .message-menu-trigger {
        border: none;
        background: transparent;
        color: #6c757d;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        font-size: 0.95rem;
        line-height: 1;
    }

    .message-menu-trigger:hover,
    .message-menu.open .message-menu-trigger {
        background: rgba(0, 0, 0, 0.06);
        color: #495057;
    }

    .message-menu-dropdown {
        position: absolute;
        right: 0;
        top: calc(100% + 4px);
        min-width: 128px;
        background: #fff;
        border: 1px solid #dee2e6;
        border-radius: 0.5rem;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
        z-index: 20;
        overflow: hidden;
        padding: 0.25rem 0;
    }

    .message-menu-item {
        display: block;
        width: 100%;
        border: none;
        background: none;
        text-align: left;
        padding: 0.45rem 0.85rem;
        font-size: 0.85rem;
        color: #212529;
        cursor: pointer;
    }

    .message-menu-item:hover {
        background: #f1f3f5;
    }

    .message-menu-item-danger {
        color: #dc3545;
    }

    .message-menu-item-danger:hover {
        background: #fdecea;
    }

    .message-edit-form {
        margin-bottom: 0.35rem;
    }

    .message-edit-input {
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.45);
        border-radius: 0.5rem;
        padding: 0.5rem;
        font-size: 0.9rem;
        resize: vertical;
        background: rgba(255, 255, 255, 0.95);
        color: #212529;
    }

    .message-edit-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.35rem;
        margin-top: 0.35rem;
    }

    .channel-item {
        padding: 1rem;
        border-bottom: 1px solid #eee;
        cursor: pointer;
        transition: background 0.2s;
    }

    .channel-item:hover {
        background: #f8f9fa;
    }

    .channel-item.active {
        background: #e7f3ff;
        border-left: 3px solid #007bff;
    }

    .channel-item .channel-name {
        font-weight: 600;
        margin-bottom: 0.25rem;
    }

    .channel-item .channel-last-message {
        font-size: 0.85rem;
        color: #6c757d;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .channel-content {
        cursor: pointer;
    }

    .message-image {
        max-width: 100%;
        max-height: 300px;
        border-radius: 0.5rem;
        margin: 0.5rem 0;
        cursor: pointer;
    }

    .message-attachment {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 0.5rem;
        margin-top: 0.5rem;
        font-size: 0.9rem;
    }

    .message-item.own .message-attachment {
        background: rgba(255, 255, 255, 0.2);
    }

    .message-attachment a {
        color: inherit;
        text-decoration: none;
    }

    .message-attachment a:hover {
        text-decoration: underline;
    }

    .message-link {
        display: inline-block;
        padding: 0.75rem 1rem;
        background: rgba(25, 103, 210, 0.08);
        border-left: 4px solid #1976d2;
        border-radius: 0.25rem;
        margin-top: 0.5rem;
    }

    .message-link a {
        color: #1565c0;
        text-decoration: none;
        word-break: break-all;
    }
</style>

<div class="container-fluid p-4" id="terminal-chat-page">
    @if(!empty($streamUnavailable))
    <div class="alert alert-warning mb-4" role="alert">
        <strong>Chat service is temporarily unavailable.</strong>
        Please try again in a few minutes. If this persists on your own server, set
        <code>STREAM_API_KEY</code> and <code>STREAM_API_SECRET</code> in the Terminal Manager
        <code>.env</code> file (same Stream app as Bus Operator, if you use cross-app chat).
    </div>
    @endif

    <div class="row">
        <!-- Channels Sidebar -->
        <div class="col-md-3">
            <div class="card shadow-sm">
                <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                    <h5 class="mb-0" style="font-weight: bold;">Channels</h5>
                    <button class="btn btn-sm btn-light" id="createChannelBtn">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
                <div class="card-body p-0" id="channels-list" style="height: calc(100vh - 200px); overflow-y: auto;">
                    <div class="text-center p-3 text-muted">
                        <i class="bi bi-chat-dots fs-1"></i>
                        <p class="mt-2">Loading channels...</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Chat Area -->
        <div class="col-md-9">
            <div class="card shadow-sm" style="height: calc(100vh - 120px);">
                <div class="card-header bg-white border-bottom d-flex justify-content-between align-items-center">
                    <div>
                        <h5 class="mb-0" id="channel-name" style="font-weight: bold;">Select a channel to start chatting</h5>
                        <small class="text-muted" id="channel-members"></small>
                    </div>
                    <div class="d-flex gap-2" id="channel-actions" style="display: none !important;">
                        <div class="dropdown">
                            <button class="btn btn-sm btn-info dropdown-toggle" type="button" id="membersDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="fa-solid fa-users"></i> Members
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="membersDropdown" id="members-list" style="max-height: 300px; overflow-y: auto; min-width: 250px;">
                                <li><span class="dropdown-item-text text-muted">No members</span></li>
                            </ul>
                        </div>
                        <button class="btn btn-sm btn-success" id="add-members-btn">
                            <i class="fa-solid fa-user-plus"></i> Add
                        </button>
                        <button class="btn btn-sm btn-warning" id="leave-channel-btn">
                            <i class="fa-solid fa-right-from-bracket"></i> Leave
                        </button>
                    </div>
                </div>
                <div class="card-body overflow-auto" id="messages-container" style="flex: 1; max-height: calc(100vh - 280px);">
                    <div class="text-center text-muted mt-5">
                        <p class="mt-3">No channel selected</p>
                    </div>
                </div>
                <div class="card-footer bg-white">
                    <form id="message-form" class="d-flex gap-2 align-items-end">
                        <div class="input-group flex-grow-1">
                            <input
                                type="text"
                                id="message-input"
                                class="form-control"
                                placeholder="Type a message or paste a link..."
                                disabled>
                            <input type="file" id="file-input" class="d-none" accept="*/*">
                            <input type="file" id="image-input" class="d-none" accept="image/*">
                            <button type="button" class="btn btn-outline-secondary" id="image-btn" title="Send image" disabled>
                                <i class="fa-solid fa-image"></i>
                            </button>
                            <button type="button" class="btn btn-outline-secondary" id="file-btn" title="Send file" disabled>
                                <i class="fa-solid fa-paperclip"></i>
                            </button>
                        </div>
                        <button type="submit" class="btn btn-primary" disabled id="send-btn">
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Create Channel Modal -->
<div class="modal fade" id="createChannelModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Create New Channel</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <form id="create-channel-form">
                    <div class="mb-3">
                        <label class="form-label">Channel Name</label>
                        <input type="text" class="form-control" id="channel-name-input" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Select Members</label>
                        <div id="members-select" class="chat-member-picker" role="group" aria-label="Select members">
                            <p class="chat-member-picker-empty text-muted mb-0">Loading users...</p>
                        </div>
                        <small class="text-muted">Check each person you want in this channel.</small>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="create-channel-submit">Create</button>
            </div>
        </div>
    </div>
</div>

<!-- Add Members Modal -->
<div class="modal fade" id="addMembersModal" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Add Members to Channel</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <form id="add-members-form">
                    <div class="mb-3">
                        <label class="form-label">Select Members to Add</label>
                        <div id="new-members-select" class="chat-member-picker" role="group" aria-label="Select members to add">
                            <p class="chat-member-picker-empty text-muted mb-0">Loading users...</p>
                        </div>
                        <small class="text-muted">Check each person to add. Only users from your terminal are shown.</small>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-success" id="add-members-submit">Add Members</button>
            </div>
        </div>
    </div>
</div>

@endsection

@push('scripts')
{{-- Match BusOperator chat: globals must be set with @json so JWT tokens and names cannot break HTML attributes or JS string literals. Layout already loads stream-chat@8 before @stack('scripts'). --}}
<script>
    window.streamApiKey = @json($streamApiKey ?? '');
    window.userId = @json($userId ?? '');
    window.streamToken = @json($streamToken ?? '');
    window.userName = @json($userName ?? '');
    window.streamUnavailable = @json(!empty($streamUnavailable));
    window.terminalManagerAppUrl = @json(rtrim(config('services.terminal_manager.url', config('app.url')), '/'));
    window.busOperatorAppUrl = @json(rtrim(config('services.bus_operator.url', 'http://localhost:8000'), '/'));
</script>
<script src="{{ asset('js/chat.js') }}"></script>
@endpush
