@extends('layouts.apptwo')

@section('title', 'Chat')

@section('content')
<div class="container-fluid p-4">
    @if(!empty($streamUnavailable))
    <div class="alert alert-warning mb-4" role="alert">
        Chat service is temporarily unavailable. Please try again in a few minutes.
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
                            
                            <button type="button" class="btn btn-outline-secondary" id="image-btn" title="Send Image" disabled>
                                <i class="bi bi-image"></i>
                            </button>
                            <button type="button" class="btn btn-outline-secondary" id="file-btn" title="Send File" disabled>
                                <i class="bi bi-paperclip"></i>
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
                        <select class="form-select" id="members-select" multiple size="5" required>
                            <option value="">Loading users...</option>
                        </select>
                        <small class="text-muted">Hold Ctrl/Cmd to select multiple users</small>
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
                        <select class="form-select" id="new-members-select" multiple size="5" required>
                            <option value="">Loading users...</option>
                        </select>
                        <small class="text-muted">Hold Ctrl/Cmd to select multiple users. Only users from your terminal are shown.</small>
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

<style>
    .message-item {
        margin-bottom: 1rem;
        display: flex;
        align-items: flex-start;
    }

    .message-item.own {
        flex-direction: row-reverse;
    }

    .message-bubble {
        max-width: 70%;
        padding: 0.75rem 1rem;
        border-radius: 1rem;
        position: relative;
    }

    .message-item.own .message-bubble {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-bottom-right-radius: 0.25rem;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
    }

    .message-item:not(.own) .message-bubble {
        background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        color: white;
        border-bottom-left-radius: 0.25rem;
        box-shadow: 0 2px 8px rgba(17, 153, 142, 0.2);
    }

    .message-author {
        font-weight: 600;
        font-size: 0.85rem;
        margin-bottom: 0.25rem;
    }

    .message-text {
        margin: 0;
        word-wrap: break-word;
    }

    .message-time {
        font-size: 0.75rem;
        opacity: 0.7;
        margin-top: 0.25rem;
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
        background: rgba(25, 103, 210, 0.05);
        border-left: 4px solid #1976d2;
        border-radius: 0.25rem;
        margin-top: 0.5rem;
    }

    .message-link a {
        color: #1565c0;
        text-decoration: none;
        word-break: break-all;
    }

    .message-link a:hover {
        text-decoration: underline;
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
</style>

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
<script src="https://cdn.jsdelivr.net/npm/stream-chat@8"></script>
<script>
    // Set global variables for chat.js
    window.streamApiKey = '{{ $streamApiKey }}';
    window.userId = '{{ $userId }}';
    window.streamToken = '{{ $streamToken }}';
    window.userName = '{{ $userName }}';
    window.streamUnavailable = @json($streamUnavailable ?? false);
</script>
<script src="/js/chat.js"></script>
@endsection