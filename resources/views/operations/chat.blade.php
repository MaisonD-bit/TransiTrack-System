@extends('layouts.app-sidebar')

@section('title', 'Chat')

@section('content')
<div class="container-fluid p-4">
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
                        <p class="mt-2" >Loading channels...</p>
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
                    <form id="message-form" class="d-flex gap-2">
                        <input 
                            type="text" 
                            id="message-input" 
                            class="form-control" 
                            placeholder="Type a message..."
                            disabled
                        >
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
}

.message-item:not(.own) .message-bubble {
    background: #f1f3f5;
    color: #333;
    border-bottom-left-radius: 0.25rem;
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

<script src="https://cdn.jsdelivr.net/npm/stream-chat@8"></script>
<script>
    const { StreamChat } = window;
    const apiKey = '{{ $streamApiKey }}';
    const userId = '{{ $userId }}';
    const userToken = '{{ $streamToken }}';
    const userName = '{{ $userName }}';

    let chatClient;
    let currentChannel;
    let channels = [];

    // Initialize chat
    async function initChat() {
        try {
            chatClient = StreamChat.getInstance(apiKey);
            
            await chatClient.connectUser(
                {
                    id: userId,
                    name: userName,
                },
                userToken
            );

            console.log('Connected to Stream Chat');
            
            await loadChannels();
            
            // Load users for create channel modal
            await loadUsers();

        } catch (error) {
            console.error('Error initializing chat:', error);
            alert('Failed to connect to chat service');
        }
    }

    async function loadChannels() {
        try {
            const filter = { 
                type: 'messaging', 
                members: { $in: [userId] } 
            };
            const sort = [{ last_message_at: -1 }];
            
            channels = await chatClient.queryChannels(filter, sort, { 
                watch: true, 
                state: true 
            });
            
            const channelsList = document.getElementById('channels-list');
            
            if (channels.length === 0) {
                channelsList.innerHTML = `
                    <div class="text-center p-3 text-muted">
                        <i class="fa-solid fa-comment-medical" style="font-size: 3rem;"></i>
                        <p class="mt-2">No channels yet. Create one to start chatting!</p>
                    </div>
                `;
                return;
            }
            
            channelsList.innerHTML = '';
            
            channels.forEach(channel => {
                const channelDiv = document.createElement('div');
                channelDiv.className = 'channel-item';
                channelDiv.dataset.channelId = channel.id;
                
                const lastMessage = channel.state.messages[channel.state.messages.length - 1];
                const lastMessageText = lastMessage ? lastMessage.text : 'No messages yet';
                
                channelDiv.innerHTML = `
                    <div class="channel-content">
                        <div class="channel-name">${channel.data.name || 'Unnamed Channel'}</div>
                        <div class="channel-last-message">${lastMessageText}</div>
                    </div>
                `;
                
                // Add click event for channel content
                channelDiv.querySelector('.channel-content').onclick = () => loadChannel(channel);
                
                channelsList.appendChild(channelDiv);
            });
            
        } catch (error) {
            console.error('Error loading channels:', error);
        }
    }


    // Load channel and messages
    async function loadChannel(channel) {
        try {
            currentChannel = channel;
            
            // Remove active class from all channels
            document.querySelectorAll('.channel-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Add active class to selected channel
            document.querySelector(`[data-channel-id="${channel.id}"]`)?.classList.add('active');
            
            // Update header
            document.getElementById('channel-name').textContent = channel.data.name || 'Chat';
            
            const memberCount = Object.keys(channel.state.members).length;
            document.getElementById('channel-members').textContent = `${memberCount} members`;
            
            // Show channel actions (members dropdown and leave button)
            document.getElementById('channel-actions').style.display = 'flex';
            
            populateMembersList(channel);
            
            // Enable input
            document.getElementById('message-input').disabled = false;
            document.getElementById('send-btn').disabled = false;
            
            // Load messages
            const state = await channel.watch();
            displayMessages(state.messages);
            
            // Listen for new messages
            channel.off('message.new'); // Remove previous listeners
            channel.on('message.new', event => {
                appendMessage(event.message);
            });
            
        } catch (error) {
            console.error('Error loading channel:', error);
        }
    }

    // Populate members list dropdown
    function populateMembersList(channel) {
        const membersList = document.getElementById('members-list');
        membersList.innerHTML = '';
        
        const members = Object.values(channel.state.members);
        const createdBy = channel.data.created_by;
        
        if (members.length === 0) {
            membersList.innerHTML = '<li><span class="dropdown-item-text text-muted">No members</span></li>';
            return;
        }
        
        members.forEach(member => {
            const isCreator = createdBy && member.user_id === createdBy.id;
            const isCurrentUser = member.user_id === userId;
            
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="dropdown-item d-flex align-items-center justify-content-between">
                    <span>
                        <i class="fa-solid fa-user me-2"></i>
                        ${member.user?.name || 'Unknown User'}
                        ${isCurrentUser ? '<span class="badge bg-secondary ms-1">You</span>' : ''}
                    </span>
                    ${isCreator ? '<span class="badge bg-primary">Creator</span>' : ''}
                </span>
            `;
            membersList.appendChild(li);
        });
    }

    function displayMessages(messages) {
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
    }

    // Append single message
    function appendMessage(message) {
        const container = document.getElementById('messages-container');
        const div = document.createElement('div');
        const isOwn = message.user.id === userId;
        
        div.className = `message-item ${isOwn ? 'own' : ''}`;
        
        div.innerHTML = `
            <div class="message-bubble">
                ${!isOwn ? `<div class="message-author">${message.user.name}</div>` : ''}
                <div class="message-text">${escapeHtml(message.text)}</div>
                <div class="message-time">${formatTime(message.created_at)}</div>
            </div>
        `;
        
        container.appendChild(div);
        scrollToBottom();
    }

    // Send message
    document.getElementById('message-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('message-input');
        
        if (input.value.trim() && currentChannel) {
            try {
                await currentChannel.sendMessage({ text: input.value.trim() });
                input.value = '';
            } catch (error) {
                console.error('Error sending message:', error);
                alert('Failed to send message');
            }
        }
    });

    // Load users for channel creation
    async function loadUsers() {
    try {
        const response = await fetch('/chat/users');
        const users = await response.json();
        
        const select = document.getElementById('members-select');
        select.innerHTML = '';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            // Format the role properly
            const formattedRole = formatRole(user.role);
            option.textContent = `${user.name} (${formattedRole})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

    // Helper function to format roles
    function formatRole(role) {
        const roleMap = {
            'northBusManager': 'North Bus Manager',
            'southBusManager': 'South Bus Manager',
            'operator': 'Operator',
            'driver': 'Driver',
            'admin': 'Administrator'
        };
        return roleMap[role] || role.charAt(0).toUpperCase() + role.slice(1);
    }

    // Create channel modal
    document.getElementById('createChannelBtn').addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('createChannelModal'));
        modal.show();
    });

    // Create channel submit
    document.getElementById('create-channel-submit').addEventListener('click', async () => {
        const channelName = document.getElementById('channel-name-input').value;
        const select = document.getElementById('members-select');
        const selectedMembers = Array.from(select.selectedOptions).map(opt => opt.value);
        
        if (!channelName || selectedMembers.length === 0) {
            alert('Please enter a channel name and select at least one member');
            return;
        }
        
        try {
            // First, register selected users in Stream via backend
            const registerResponse = await fetch('/chat/register-users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || ''
                },
                body: JSON.stringify({
                    user_ids: selectedMembers
                })
            });

            if (!registerResponse.ok) {
                throw new Error('Failed to register users');
            }
            
            // Add current user to members
            const members = [userId, ...selectedMembers];
            
            // Create channel with unique ID
            const channelId = 'channel-' + Date.now();
            const channel = chatClient.channel('messaging', channelId, {
                name: channelName,
            });
            
            // Create channel and add members
            await channel.create();
            await channel.addMembers(members);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createChannelModal'));
            modal.hide();
            
            // Clear form
            document.getElementById('channel-name-input').value = '';
            document.getElementById('members-select').selectedIndex = -1;
            
            // Reload channels
            await loadChannels();
            
            // Open the new channel
            await loadChannel(channel);
            
        } catch (error) {
            console.error('Error creating channel:', error);
            alert('Failed to create channel');
        }
    });

    // Helper functions
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
        if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    function scrollToBottom() {
        const container = document.getElementById('messages-container');
        container.scrollTop = container.scrollHeight;
    }

    // Leave channel function
    async function leaveChannel() {
        if (!currentChannel) {
            alert('No channel selected');
            return;
        }

        try {
            // Check if current user is the creator
            const createdBy = currentChannel.data.created_by;
            const isCreator = createdBy && createdBy.id === userId;

            let confirmMessage;
            if (isCreator) {
                confirmMessage = 'You are the creator of this channel. If you leave, the channel will be permanently deleted for all members. Are you sure?';
            } else {
                confirmMessage = 'Are you sure you want to leave this channel?';
            }

            if (!confirm(confirmMessage)) {
                return;
            }

            if (isCreator) {
                // Creator is leaving - delete the entire channel
                await currentChannel.delete();
                alert('Channel has been permanently deleted');
            } else {
                // Regular member leaving - just remove from channel
                await currentChannel.removeMembers([userId]);
                alert('You have left the channel');
            }

            // Clear the chat area
            clearChatArea();

            // Reload channels list
            await loadChannels();

        } catch (error) {
            console.error('Error leaving channel:', error);
            alert('Failed to leave channel: ' + error.message);
        }
    }

    // Clear chat area helper function
    function clearChatArea() {
        currentChannel = null;
        document.getElementById('channel-name').textContent = 'Select a channel to start chatting';
        document.getElementById('channel-members').textContent = '';
        document.getElementById('messages-container').innerHTML = `
            <div class="text-center text-muted mt-5">
                <i class="fa-solid fa-comment-slash" style="font-size: 3rem;"></i>
                <p class="mt-3">No channel selected</p>
            </div>
        `;
        document.getElementById('message-input').disabled = true;
        document.getElementById('send-btn').disabled = true;
        document.getElementById('channel-actions').style.display = 'none';
    }

    // Add members button
    document.getElementById('add-members-btn').addEventListener('click', async () => {
        if (!currentChannel) {
            alert('No channel selected');
            return;
        }
        
        // Load available users (excluding current members, filtered by terminal)
        await loadAvailableUsers();
        
        const modal = new bootstrap.Modal(document.getElementById('addMembersModal'));
        modal.show();
    });

    // Add members submit
    document.getElementById('add-members-submit').addEventListener('click', async () => {
        if (!currentChannel) {
            alert('No channel selected');
            return;
        }
        
        const select = document.getElementById('new-members-select');
        const selectedMembers = Array.from(select.selectedOptions).map(opt => opt.value);
        
        if (selectedMembers.length === 0) {
            alert('Please select at least one member to add');
            return;
        }
        
        try {
            // Register selected users in Stream via backend
            const registerResponse = await fetch('/chat/register-users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || ''
                },
                body: JSON.stringify({
                    user_ids: selectedMembers
                })
            });

            if (!registerResponse.ok) {
                throw new Error('Failed to register users');
            }
            
            // Add members to the channel
            await currentChannel.addMembers(selectedMembers);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addMembersModal'));
            modal.hide();
            
            // Clear form
            document.getElementById('new-members-select').selectedIndex = -1;
            
            // Refresh channel to get updated member list
            await currentChannel.watch();
            
            // Update members display
            const memberCount = Object.keys(currentChannel.state.members).length;
            document.getElementById('channel-members').textContent = `${memberCount} members`;
            populateMembersList(currentChannel);
            
            alert(`Successfully added ${selectedMembers.length} member(s) to the channel`);
            
        } catch (error) {
            console.error('Error adding members:', error);
            alert('Failed to add members: ' + error.message);
        }
    });

    // Load available users (excluding current channel members, filtered by same terminal)
    async function loadAvailableUsers() {
        try {
            const response = await fetch('/chat/users');
            const users = await response.json();
            
            const select = document.getElementById('new-members-select');
            select.innerHTML = '';
            
            // Get current channel member IDs
            const currentMemberIds = currentChannel ? 
                Object.keys(currentChannel.state.members) : [];
            
            // Filter out users who are already members
            // The backend already filters by terminal in ChatController@getUsers
            const availableUsers = users.filter(user => 
                !currentMemberIds.includes(user.id.toString())
            );
            
            if (availableUsers.length === 0) {
                select.innerHTML = '<option value="" disabled>All users from your terminal are already members</option>';
                return;
            }
            
            availableUsers.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                const formattedRole = formatRole(user.role);
                option.textContent = `${user.name} (${formattedRole})`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading available users:', error);
        }
    }

    // Leave channel button event listener
    document.getElementById('leave-channel-btn').addEventListener('click', leaveChannel);

    // Initialize on page load
    initChat();
</script>
@endsection
