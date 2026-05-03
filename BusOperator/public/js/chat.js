const {
    StreamChat
} = window;

let chatClient;
let currentChannel;
let channels = [];
let displayedMessageIds = new Set(); // Track displayed message IDs to prevent duplicates

// Initialize chat
async function initChat() {
    try {
        console.log('Initializing Stream Chat with API key:', window.streamApiKey.substring(0, 5) + '...');
        chatClient = StreamChat.getInstance(window.streamApiKey);

        console.log('Connecting user:', window.userId, window.userName);
        await chatClient.connectUser({
                id: window.userId,
                name: window.userName,
            },
            window.streamToken
        );

        console.log('Connected to Stream Chat successfully');

        await loadChannels();

        // Load users for create channel modal
        await loadUsers();

        console.log('Chat initialization completed successfully');

    } catch (error) {
        console.error('Error initializing chat:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        
        const channelsList = document.getElementById('channels-list');
        channelsList.innerHTML = `
            <div class="alert alert-danger m-3" role="alert">
                <strong>Chat connection failed:</strong><br/>
                ${error.message}
            </div>
        `;
    }
}

async function loadChannels() {
    try {
        console.log('Loading channels for userId:', window.userId);
        const filter = {
            type: 'messaging',
            members: {
                $in: [window.userId]
            }
        };
        const sort = [{
            last_message_at: -1
        }];

        console.log('Querying channels with filter:', filter);
        channels = await chatClient.queryChannels(filter, sort, {
            watch: true,
            state: true
        });

        console.log('Channels loaded successfully:', channels.length, 'channels');
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
        const channelsList = document.getElementById('channels-list');
        channelsList.innerHTML = `
            <div class="alert alert-danger m-3" role="alert">
                <strong>Error loading channels:</strong> ${error.message}
            </div>
        `;
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
        document.getElementById('image-btn').disabled = false;
        document.getElementById('file-btn').disabled = false;

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
        const isCurrentUser = member.user_id === window.userId;

        const li = document.createElement('li');
        li.innerHTML = `
            <span class="dropdown-item d-flex align-items-center justify-content-between gap-2">
                <span class="d-flex align-items-center gap-2 flex-grow-1 min-width-0">
                    <i class="fa-solid fa-user flex-shrink-0"></i>
                    <span class="text-truncate">${member.user?.name || 'Unknown User'}</span>
                </span>
                <span class="d-flex gap-1 flex-shrink-0">
                    ${isCurrentUser ? '<span class="badge bg-secondary">You</span>' : ''}
                    ${isCreator ? '<span class="badge bg-primary">Creator</span>' : ''}
                </span>
            </span>
        `;
        membersList.appendChild(li);
    });
}

function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    displayedMessageIds.clear(); // Reset message tracking when displaying new messages
    messages.forEach(msg => appendMessage(msg));
    scrollToBottom();
}

// Append single message
function appendMessage(message) {
    // Prevent duplicate messages from appearing
    if (displayedMessageIds.has(message.id)) {
        console.log('Skipping duplicate message:', message.id);
        return;
    }
    
    displayedMessageIds.add(message.id);
    
    const container = document.getElementById('messages-container');
    const div = document.createElement('div');
    const isOwn = message.user.id === window.userId;

    div.className = `message-item ${isOwn ? 'own' : ''}`;
    div.dataset.messageId = message.id; // Add message ID to DOM for tracking

    // Build message content with attachments
    let attachmentHtml = '';
    if (message.attachments && message.attachments.length > 0) {
        message.attachments.forEach(att => {
            if (att.type === 'image') {
                attachmentHtml += `<img src="${escapeHtml(att.image_url || '')}" alt="image" class="message-image" style="max-width: 200px;">`;
            } else if (att.type === 'file') {
                const fileName = att.title || att.fallback || 'File';
                attachmentHtml += `<div class="message-attachment"><i class="bi bi-file"></i><a href="${escapeHtml(att.asset_url || '')}" download="${fileName}">${escapeHtml(fileName)}</a></div>`;
            } else if (att.type === 'link') {
                attachmentHtml += `<div class="message-link"><a href="${escapeHtml(att.url)}" target="_blank" rel="noopener">${escapeHtml(att.url)}</a></div>`;
            }
        });
    }

    div.innerHTML = `
        <div class="message-bubble">
            ${!isOwn ? `<div class="message-author">${message.user.name}</div>` : ''}
            <div class="message-text">${escapeHtml(message.text)}</div>
            ${attachmentHtml}
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
            const messageText = input.value.trim();
            
            // Check if message contains a URL
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = messageText.match(urlRegex);
            
            const messageData = { text: messageText };
            
            // If URLs found, add attachments
            if (urls) {
                messageData.attachments = urls.map(url => ({
                    type: 'link',
                    url: url,
                    title: url
                }));
            }
            
            await currentChannel.sendMessage(messageData);
            input.value = '';
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        }
    }
});

// Image button handler
document.getElementById('image-btn').addEventListener('click', () => {
    document.getElementById('image-input').click();
});

document.getElementById('image-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && currentChannel) {
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target.result;
                await currentChannel.sendMessage({
                    text: '📷 Image',
                    attachments: [{
                        type: 'image',
                        image_url: base64,
                        fallback: file.name
                    }]
                });
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error sending image:', error);
            alert('Failed to send image');
        }
    }
    e.target.value = ''; // Reset input
});

// File button handler
document.getElementById('file-btn').addEventListener('click', () => {
    document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && currentChannel) {
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target.result;
                await currentChannel.sendMessage({
                    text: `📎 ${file.name}`,
                    attachments: [{
                        type: 'file',
                        asset_url: base64,
                        title: file.name,
                        fallback: file.name,
                        file_size: file.size
                    }]
                });
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error sending file:', error);
            alert('Failed to send file');
        }
    }
    e.target.value = ''; // Reset input
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
            const formattedRole = formatRole(user.role, user.terminal, user.formatted_role);
            option.textContent = `${user.name} (${formattedRole})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Helper function to format roles
function formatRole(role, terminal = null, formattedRole = null) {
    if (formattedRole) {
        return formattedRole;
    }

    const roleMap = {
        'northBusManager': 'North Bus Manager',
        'southBusManager': 'South Bus Manager',
        'terminalManager': terminal === 'north' ? 'North Bus Terminal Manager' : (terminal === 'south' ? 'South Bus Terminal Manager' : 'Bus Terminal Manager'),
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
        const channelId = 'channel-' + Date.now();
        console.log('Creating channel:', { 
            channelId, 
            channelName, 
            selectedMembers,
            creatorId: window.userId,
            note: 'You (the creator) will be automatically added to the channel'
        });

        const response = await fetch('/chat/channel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || ''
            },
            body: JSON.stringify({
                type: 'messaging',
                id: channelId,
                name: channelName,
                members: selectedMembers
            })
        });

        console.log('Channel creation response status:', response.status);
        const responseData = await response.json().catch(() => ({}));
        console.log('Channel creation response data:', responseData);

        if (!response.ok || !responseData.success) {
            throw new Error(responseData.error || 'Failed to create channel');
        }
        
        console.log('Channel created successfully:', responseData);
        alert(`Channel "${channelName}" created successfully! Note: You (the creator) have been automatically added to the channel.`);

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createChannelModal'));
        modal.hide();

        // Clear form
        document.getElementById('channel-name-input').value = '';
        document.getElementById('members-select').selectedIndex = -1;

        // Reload channels
        await loadChannels();

        // Open the new channel
        const channel = chatClient.channel('messaging', channelId);
        await loadChannel(channel);

    } catch (error) {
        console.error('Error creating channel:', error);
        alert(error.message || 'Failed to create channel');
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
    if (diff < 86400000) return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
    });
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
        const isCreator = createdBy && createdBy.id === window.userId;

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
            await currentChannel.removeMembers([window.userId]);
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
    document.getElementById('image-btn').disabled = true;
    document.getElementById('file-btn').disabled = true;
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
        console.log('Loading available users for channel:', currentChannel?.id);
        const response = await fetch('/chat/users');
        console.log('Users response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const users = await response.json();
        
        console.log('Users response from /chat/users:', users);
        console.log('Response type:', typeof users, 'Is Array:', Array.isArray(users));
        
        if (!Array.isArray(users)) {
            throw new Error('Expected users to be an array, got: ' + typeof users);
        }
        
        console.log('Total users returned:', users.length);
        users.forEach((user, index) => {
            console.log(`User ${index}:`, user.id, user.name, user.role);
        });

        const select = document.getElementById('new-members-select');
        select.innerHTML = '';

        // Get current channel member IDs
        const currentMemberIds = currentChannel ?
            Object.keys(currentChannel.state.members) : [];
        
        console.log('Current channel members:', currentMemberIds);

        // Filter out users who are already members
        // The backend already filters by terminal in ChatController@getUsers
        const availableUsers = users.filter(user => {
            const isAlreadyMember = currentMemberIds.includes(user.id.toString());
            console.log(`User ${user.name} (${user.id}): already member = ${isAlreadyMember}`);
            return !isAlreadyMember;
        });

        console.log('Available users after filtering:', availableUsers.length);
        availableUsers.forEach(user => {
            console.log('  -', user.name, '(' + user.role + ')');
        });

        if (availableUsers.length === 0) {
            console.warn('No available users to add');
            select.innerHTML = '<option value="" disabled selected>All users from your terminal are already members</option>';
            return;
        }

        availableUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            const formattedRole = formatRole(user.role, user.terminal, user.formatted_role);
            option.textContent = `${user.name} (${formattedRole})`;
            select.appendChild(option);
        });
        
        console.log('Successfully populated', availableUsers.length, 'users in dropdown');
    } catch (error) {
        console.error('Error loading available users:', error);
        console.error('Error stack:', error.stack);
        const select = document.getElementById('new-members-select');
        select.innerHTML = '<option value="" disabled selected>Error loading users: ' + error.message + '</option>';
        alert('Failed to load available users: ' + error.message);
    }
}

// Leave channel button event listener
document.getElementById('leave-channel-btn').addEventListener('click', leaveChannel);

// Initialize on page load
if (window.streamUnavailable || !window.streamApiKey || !window.streamToken) {
    const channelsList = document.getElementById('channels-list');
    const createChannelBtn = document.getElementById('createChannelBtn');

    if (createChannelBtn) {
        createChannelBtn.disabled = true;
    }

    if (channelsList) {
        channelsList.innerHTML = `
            <div class="text-center p-3 text-muted">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem;"></i>
                <p class="mt-2 mb-0">Chat service is temporarily unavailable.</p>
            </div>
        `;
    }
} else {
    initChat();
}
