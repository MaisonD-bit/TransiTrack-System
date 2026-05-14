 const {
        StreamChat
    } = window;
    
    // Get chat configuration from data attributes
    const chatContainer = document.querySelector('[data-api-key]');
    let apiKey = '';
    let userId = '';
    let userToken = '';
    let userName = '';
    let streamUnavailable = false;
    
    if (chatContainer) {
        apiKey = chatContainer.dataset.apiKey || '';
        userId = chatContainer.dataset.userId || '';
        userToken = chatContainer.dataset.userToken || '';
        userName = chatContainer.dataset.userName || '';
        try {
            streamUnavailable = JSON.parse(chatContainer.dataset.streamUnavailable || 'false');
        } catch (e) {
            console.error('Error parsing streamUnavailable:', e);
        }
    }

    let chatClient;
    let currentChannel;
    let channels = [];

    // Robust fetch helper that sends credentials and expects JSON
    async function fetchJson(url, options = {}) {
        const opts = Object.assign({
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json'
            }
        }, options || {});

        const res = await fetch(url, opts);

        // If the response is not OK, try to capture text for debugging
        if (!res.ok) {
            const text = await res.text().catch(() => null);
            console.error(`Request to ${url} failed with status ${res.status}`, text);
            const err = new Error('Request failed');
            err.status = res.status;
            err.body = text;
            throw err;
        }

        // Attempt to parse JSON, otherwise surface a helpful error
        const contentType = res.headers.get('content-type') || '';
        const bodyText = await res.text();
        if (!contentType.includes('application/json')) {
            // Likely an HTML error (login redirect or exception page)
            console.error(`Expected JSON from ${url} but received:`, bodyText);
            const err = new Error('Invalid JSON response');
            err.status = res.status;
            err.body = bodyText;
            throw err;
        }

        try {
            return JSON.parse(bodyText);
        } catch (e) {
            console.error('Failed to parse JSON from', url, bodyText);
            throw e;
        }
    }

    function channelPreviewText(lastMessage) {
        if (!lastMessage) {
            return 'No messages yet';
        }
        if (lastMessage.text && String(lastMessage.text).trim()) {
            return lastMessage.text;
        }
        const atts = lastMessage.attachments;
        if (atts && atts.length) {
            const a = atts[0];
            if (a.type === 'image') {
                return '📷 Image';
            }
            if (a.type === 'file') {
                return '📎 ' + (a.title || a.fallback || 'File');
            }
            if (a.type === 'link') {
                return '🔗 Link';
            }
        }
        return 'Message';
    }

    function escapeHtml(text) {
        if (text == null) {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function uploadAndSendImage(file) {
        if (!currentChannel || !file) {
            return;
        }
        try {
            const upload = await currentChannel.sendImage(file);
            const imageUrl = typeof upload.file === 'string' ? upload.file : (upload.file && upload.file.url) || upload.url;
            if (!imageUrl) {
                throw new Error('Upload did not return a URL');
            }
            await currentChannel.sendMessage({
                text: file.name ? '📷 ' + file.name : '📷 Image',
                attachments: [{
                    type: 'image',
                    image_url: imageUrl,
                    fallback: file.name || 'Image',
                }],
            });
        } catch (error) {
            console.error('Error sending image:', error);
            alert('Failed to send image. Use a smaller image or check your connection.');
        }
    }

    async function uploadAndSendFile(file) {
        if (!currentChannel || !file) {
            return;
        }
        try {
            const upload = await currentChannel.sendFile(file);
            const assetUrl = typeof upload.file === 'string' ? upload.file : (upload.file && upload.file.url) || upload.url;
            if (!assetUrl) {
                throw new Error('Upload did not return a URL');
            }
            await currentChannel.sendMessage({
                text: '📎 ' + file.name,
                attachments: [{
                    type: 'file',
                    asset_url: assetUrl,
                    title: file.name,
                    fallback: file.name,
                    file_size: file.size,
                    mime_type: file.type || undefined,
                }],
            });
        } catch (error) {
            console.error('Error sending file:', error);
            alert('Failed to send file. It may be too large or blocked.');
        }
    }

    // Initialize chat
    async function initChat() {
        try {
            chatClient = StreamChat.getInstance(apiKey);

            await chatClient.connectUser({
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
                members: {
                    $in: [userId]
                }
            };
            const sort = [{
                last_message_at: -1
            }];

            channels = await chatClient.queryChannels(filter, sort, {
                watch: true,
                state: true
            });

            const channelsList = document.getElementById('channels-list');
            if (!channelsList) {
                console.error('channels-list element not found');
                return;
            }

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
                const lastMessageText = channelPreviewText(lastMessage);

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
            const channelItem = document.querySelector(`[data-channel-id="${channel.id}"]`);
            if (channelItem) {
                channelItem.classList.add('active');
            }

            // Update header
            const channelNameEl = document.getElementById('channel-name');
            if (channelNameEl) {
                channelNameEl.textContent = channel.data.name || 'Chat';
            }

            const memberCount = Object.keys(channel.state.members).length;
            const channelMembersEl = document.getElementById('channel-members');
            if (channelMembersEl) {
                channelMembersEl.textContent = `${memberCount} members`;
            }

            // Show channel actions (members dropdown and leave button)
            const channelActionsEl = document.getElementById('channel-actions');
            if (channelActionsEl) {
                channelActionsEl.style.display = 'flex';
            }

            populateMembersList(channel);

            // Enable input
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.disabled = false;
            }
            
            const sendBtn = document.getElementById('send-btn');
            if (sendBtn) {
                sendBtn.disabled = false;
            }
            
            const imageBtnEl = document.getElementById('image-btn');
            if (imageBtnEl) {
                imageBtnEl.disabled = false;
            }
            
            const fileBtnEl = document.getElementById('file-btn');
            if (fileBtnEl) {
                fileBtnEl.disabled = false;
            }

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
        if (!membersList) {
            console.error('members-list element not found');
            return;
        }
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
        if (!container) {
            console.error('messages-container element not found');
            return;
        }
        container.innerHTML = '';
        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
    }

    // Append single message
    function appendMessage(message) {
        const container = document.getElementById('messages-container');
        if (!container || !message.user) {
            return;
        }
        const div = document.createElement('div');
        const isOwn = message.user.id === userId;

        div.className = `message-item ${isOwn ? 'own' : ''}`;

        let attachmentHtml = '';
        if (message.attachments && message.attachments.length > 0) {
            message.attachments.forEach(att => {
                if (att.type === 'image') {
                    const src = att.image_url || att.thumb_url || att.asset_url || '';
                    if (src) {
                        attachmentHtml += `<img src="${escapeHtml(src)}" alt="" class="message-image" loading="lazy">`;
                    }
                } else if (att.type === 'file') {
                    const fileName = att.title || att.fallback || 'File';
                    const href = att.asset_url || att.url || '#';
                    attachmentHtml += `<div class="message-attachment"><i class="fa-solid fa-file me-1"></i><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" download="${escapeHtml(fileName)}">${escapeHtml(fileName)}</a></div>`;
                } else if (att.type === 'link') {
                    attachmentHtml += `<div class="message-link"><a href="${escapeHtml(att.url)}" target="_blank" rel="noopener">${escapeHtml(att.url)}</a></div>`;
                }
            });
        }

        const text = (message.text || '').trim();
        const textBlock = text ? `<div class="message-text">${escapeHtml(message.text)}</div>` : '';

        div.innerHTML = `
            <div class="message-bubble">
                ${!isOwn ? `<div class="message-author">${escapeHtml(message.user.name || '')}</div>` : ''}
                ${textBlock}
                ${attachmentHtml}
                <div class="message-time">${formatTime(message.created_at)}</div>
            </div>
        `;

        container.appendChild(div);
        scrollToBottom();
    }

    // Send message
    const messageForm = document.getElementById('message-form');
    if (messageForm) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('message-input');

            if (input && input.value.trim() && currentChannel) {
                try {
                    const messageText = input.value.trim();
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const urls = messageText.match(urlRegex);
                    const messageData = { text: messageText };
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
    }

    const imageBtn = document.getElementById('image-btn');
    if (imageBtn) {
        imageBtn.addEventListener('click', () => {
            document.getElementById('image-input').click();
        });
    }

    const imageInput = document.getElementById('image-input');
    if (imageInput) {
        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && currentChannel) {
                await uploadAndSendImage(file);
            }
            e.target.value = '';
        });
    }

    const fileBtn = document.getElementById('file-btn');
    if (fileBtn) {
        fileBtn.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
    }

    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && currentChannel) {
                await uploadAndSendFile(file);
            }
            e.target.value = '';
        });
    }

    // Load users for channel creation
    async function loadUsers() {
        try {
            const users = await fetchJson('/chat/users');

            const select = document.getElementById('members-select');
            if (!select) {
                console.error('members-select element not found');
                return;
            }
            select.innerHTML = '';

            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                const formattedRole = formatRole(user.role, user.terminal, user.formatted_role);
                option.textContent = `${user.name} (${formattedRole})`;
                select.appendChild(option);
            });

            if (users.length === 0) {
                select.innerHTML = '<option value="" disabled>No users available</option>';
            }
        } catch (error) {
            console.error('Error loading users:', error);
            const select = document.getElementById('members-select');
            if (select) {
                select.innerHTML = '<option value="" disabled>Error loading users</option>';
            }
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
    const createChannelBtn = document.getElementById('createChannelBtn');
    if (createChannelBtn) {
        createChannelBtn.addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('createChannelModal'));
            modal.show();
        });
    }

    // Create channel submit
    const createChannelSubmit = document.getElementById('create-channel-submit');
    if (createChannelSubmit) {
        createChannelSubmit.addEventListener('click', async () => {
            const channelName = document.getElementById('channel-name-input').value;
            const select = document.getElementById('members-select');
            const selectedMembers = Array.from(select.selectedOptions).map(opt => opt.value);

            if (!channelName || selectedMembers.length === 0) {
                alert('Please enter a channel name and select at least one member');
                return;
            }

            try {
                const channelId = 'channel-' + Date.now();

                const responseData = await fetchJson('/chat/channel', {
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

                if (!responseData || !responseData.success) {
                    throw new Error(responseData?.error || 'Failed to create channel');
                }

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
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
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
        
        const channelName = document.getElementById('channel-name');
        if (channelName) {
            channelName.textContent = 'Select a channel to start chatting';
        }
        
        const channelMembers = document.getElementById('channel-members');
        if (channelMembers) {
            channelMembers.textContent = '';
        }
        
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="text-center text-muted mt-5">
                    <i class="fa-solid fa-comment-slash" style="font-size: 3rem;"></i>
                    <p class="mt-3">No channel selected</p>
                </div>
            `;
        }
        
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.disabled = true;
        }
        
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.disabled = true;
        }
        
        const imageBtn = document.getElementById('image-btn');
        if (imageBtn) {
            imageBtn.disabled = true;
        }
        
        const fileBtn = document.getElementById('file-btn');
        if (fileBtn) {
            fileBtn.disabled = true;
        }
        
        const channelActions = document.getElementById('channel-actions');
        if (channelActions) {
            channelActions.style.display = 'none';
        }
    }

    // Add members button
    const addMembersBtn = document.getElementById('add-members-btn');
    if (addMembersBtn) {
        addMembersBtn.addEventListener('click', async () => {
            if (!currentChannel) {
                alert('No channel selected');
                return;
            }

            // Load available users (excluding current members, filtered by terminal)
            await loadAvailableUsers();

            const modal = new bootstrap.Modal(document.getElementById('addMembersModal'));
            modal.show();
        });
    }

    // Add members submit
    const addMembersSubmit = document.getElementById('add-members-submit');
    if (addMembersSubmit) {
        addMembersSubmit.addEventListener('click', async () => {
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
                const registerResult = await fetchJson('/chat/register-users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || ''
                    },
                    body: JSON.stringify({
                        user_ids: selectedMembers
                    })
                });

                if (!registerResult || !registerResult.success) {
                    throw new Error(registerResult?.error || 'Failed to register users');
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
                alert('Failed to add members: ' + (error.message || error));
            }
        });
    }

    // Load available users (excluding current channel members, filtered by same terminal)
    async function loadAvailableUsers() {
        try {
            const users = await fetchJson('/chat/users');

            const select = document.getElementById('new-members-select');
            if (!select) {
                console.error('new-members-select element not found');
                return;
            }
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
                const formattedRole = formatRole(user.role, user.terminal, user.formatted_role);
                option.textContent = `${user.name} (${formattedRole})`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading available users:', error);
            const select = document.getElementById('new-members-select');
            if (select) {
                select.innerHTML = '<option value="" disabled>Error loading users</option>';
            }
        }
    }

    // Leave channel button event listener
    const leaveChannelBtn = document.getElementById('leave-channel-btn');
    if (leaveChannelBtn) {
        leaveChannelBtn.addEventListener('click', leaveChannel);
    }

    // Initialize on page load
    if (streamUnavailable || !apiKey || !userToken) {
        const channelsList = document.getElementById('channels-list');
        const createChannelBtn = document.getElementById('createChannelBtn');

        if (createChannelBtn) {
            createChannelBtn.disabled = true;
            createChannelBtn.title = 'Chat service is unavailable';
        }

        if (channelsList) {
            channelsList.innerHTML = `
                <div class="text-center p-3 text-muted">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem;"></i>
                    <p class="mt-2 mb-0">Chat service is temporarily unavailable.</p>
                </div>
            `;
        }
    } else if (typeof StreamChat !== 'undefined') {
        initChat();
    } else {
        const channelsList = document.getElementById('channels-list');
        if (channelsList) {
            channelsList.innerHTML = `
                <div class="text-center p-3 text-muted">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem;"></i>
                    <p class="mt-2 mb-0">Chat script failed to load.</p>
                </div>
            `;
        }
    }
