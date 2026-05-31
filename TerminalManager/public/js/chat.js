const {
    StreamChat
} = window;

// Prefer window.* (same as BusOperator chat blade); fall back to data-* on container.
const chatContainer = document.querySelector('[data-api-key]');
let apiKey = '';
let userId = '';
let userToken = '';
let userName = '';
let streamUnavailable = false;

if (typeof window.streamApiKey === 'string') {
    apiKey = window.streamApiKey;
    userId = String(window.userId != null ? window.userId : '');
    userToken = window.streamToken || '';
    userName = window.userName || '';
    streamUnavailable = !!window.streamUnavailable;
} else if (chatContainer) {
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
    let channelMessageHandler = null;
    let channelMessageUpdatedHandler = null;
    let channelMessageDeletedHandler = null;
    const renderedMessageIds = new Set();

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
        if (lastMessage.deleted_at) {
            return 'Message deleted';
        }
        const text = (lastMessage.text || '').trim();
        if (text && !isRedundantAttachmentCaption(text)) {
            return text.length > 60 ? text.slice(0, 60) + '…' : text;
        }
        const atts = lastMessage.attachments;
        if (atts && atts.length) {
            const a = atts[0];
            if (a.type === 'image') {
                return 'Image';
            }
            if (a.type === 'file') {
                return 'Attachment';
            }
            if (a.type === 'link') {
                return 'Link';
            }
        }
        return 'Message';
    }

    async function chatConfirm(message) {
        if (typeof showSpaceConfirm === 'function') {
            return showSpaceConfirm(message);
        }
        return confirm(message);
    }

    function chatAlert(message, type = 'info') {
        if (typeof showSpaceAlert === 'function') {
            showSpaceAlert(message, type);
        } else {
            alert(message);
        }
    }

    function isOwnMessage(message) {
        return message.user && String(message.user.id) === String(userId);
    }

    function isMessageEdited(message) {
        if (!message.updated_at || !message.created_at) {
            return false;
        }
        return new Date(message.updated_at).getTime() > new Date(message.created_at).getTime() + 1000;
    }

    function canEditMessage(message) {
        if (!isOwnMessage(message) || message.deleted_at) {
            return false;
        }
        const text = (message.text || '').trim();
        return text.length > 0 && !isRedundantAttachmentCaption(text);
    }

    function canDeleteMessage(message) {
        return isOwnMessage(message) && !!message.id && !message.deleted_at;
    }

    function getMessageById(messageId) {
        if (!currentChannel || !messageId) {
            return null;
        }
        return currentChannel.state.messages.find(m => m.id === messageId) || null;
    }

    function updateChannelListPreview() {
        if (!currentChannel) {
            return;
        }
        const channelItem = document.querySelector(`[data-channel-id="${currentChannel.id}"]`);
        if (!channelItem) {
            return;
        }
        const previewEl = channelItem.querySelector('.channel-last-message');
        if (!previewEl) {
            return;
        }
        const messages = currentChannel.state.messages || [];
        const lastMessage = messages[messages.length - 1];
        previewEl.textContent = channelPreviewText(lastMessage);
    }

    function escapeHtml(text) {
        if (text == null) {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function resolveChatMediaUrl(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }
        const trimmed = url.trim();
        if (!trimmed || /^https?:\/\//i.test(trimmed)) {
            return trimmed;
        }
        const tmBase = (window.terminalManagerAppUrl || window.location.origin || '').replace(/\/$/, '');
        const boBase = (window.busOperatorAppUrl || 'http://localhost:8000').replace(/\/$/, '');
        if (trimmed.startsWith('/storage/')) {
            return tmBase + trimmed;
        }
        if (trimmed.startsWith('storage/')) {
            return tmBase + '/' + trimmed;
        }
        if (trimmed.startsWith('operators/') || trimmed.startsWith('drivers/')) {
            return boBase + '/storage/' + trimmed;
        }
        if (trimmed.startsWith('managers/')) {
            return tmBase + '/storage/' + trimmed;
        }
        return tmBase + '/storage/' + trimmed.replace(/^\//, '');
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
                attachments: [{
                    type: 'image',
                    image_url: imageUrl,
                    fallback: 'Image',
                }],
            });
        } catch (error) {
            console.error('Error sending image:', error);
            chatAlert('Failed to send image. Use a smaller image or check your connection.', 'error');
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
            chatAlert('Failed to send file. It may be too large or blocked.', 'error');
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
            const channelsList = document.getElementById('channels-list');
            if (channelsList) {
                channelsList.innerHTML = `
                    <div class="alert alert-danger m-3" role="alert">
                        <strong>Chat connection failed:</strong><br/>
                        ${escapeHtml(error.message || 'Unknown error')}
                    </div>
                `;
            } else {
                chatAlert('Failed to connect to chat service', 'error');
            }
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

            if (channelMessageHandler) {
                channel.off('message.new', channelMessageHandler);
            }
            channelMessageHandler = (event) => {
                appendMessage(event.message);
                updateChannelListPreview();
            };
            channel.on('message.new', channelMessageHandler);

            if (channelMessageUpdatedHandler) {
                channel.off('message.updated', channelMessageUpdatedHandler);
            }
            channelMessageUpdatedHandler = (event) => {
                refreshMessageInDom(event.message);
                updateChannelListPreview();
            };
            channel.on('message.updated', channelMessageUpdatedHandler);

            if (channelMessageDeletedHandler) {
                channel.off('message.deleted', channelMessageDeletedHandler);
            }
            channelMessageDeletedHandler = (event) => {
                removeMessageFromDom(event.message.id);
                updateChannelListPreview();
            };
            channel.on('message.deleted', channelMessageDeletedHandler);

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
        renderedMessageIds.clear();
        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
    }

    function isRedundantAttachmentCaption(text) {
        const t = (text || '').trim();
        if (!t) {
            return true;
        }
        return /^📷\s/.test(t) || /^📎\s/.test(t);
    }

    function buildAttachmentHtml(message) {
        let attachmentHtml = '';
        if (!message.attachments || !message.attachments.length) {
            return attachmentHtml;
        }
        message.attachments.forEach(att => {
            if (att.type === 'image') {
                const src = resolveChatMediaUrl(att.image_url || att.thumb_url || att.asset_url || '');
                if (src) {
                    attachmentHtml += `<img src="${escapeHtml(src)}" alt="" class="message-image" loading="lazy">`;
                }
            } else if (att.type === 'file') {
                const fileName = att.title || att.fallback || 'File';
                const href = resolveChatMediaUrl(att.asset_url || att.url || '') || '#';
                attachmentHtml += `<div class="message-attachment"><i class="fa-solid fa-file me-1"></i><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" download="${escapeHtml(fileName)}">${escapeHtml(fileName)}</a></div>`;
            } else if (att.type === 'link') {
                attachmentHtml += `<div class="message-link"><a href="${escapeHtml(att.url)}" target="_blank" rel="noopener">${escapeHtml(att.url)}</a></div>`;
            }
        });
        return attachmentHtml;
    }

    function closeAllMessageMenus() {
        document.querySelectorAll('.message-menu.open').forEach((menu) => {
            menu.classList.remove('open');
            const dropdown = menu.querySelector('.message-menu-dropdown');
            const trigger = menu.querySelector('.message-menu-trigger');
            if (dropdown) {
                dropdown.hidden = true;
            }
            if (trigger) {
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    function buildMessageMenuHtml(message, isOwn) {
        if (!isOwn || !message.id || message.deleted_at) {
            return '';
        }
        const items = [];
        if (canEditMessage(message)) {
            items.push('<button type="button" class="message-menu-item" data-action="edit">Edit</button>');
        }
        if (canDeleteMessage(message)) {
            items.push('<button type="button" class="message-menu-item message-menu-item-danger" data-action="delete">Delete</button>');
        }
        if (!items.length) {
            return '';
        }
        return `
            <div class="message-menu" data-message-id="${escapeHtml(message.id)}">
                <button type="button" class="message-menu-trigger" aria-label="Message options" aria-expanded="false" aria-haspopup="true">
                    <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
                </button>
                <div class="message-menu-dropdown" hidden>
                    ${items.join('')}
                </div>
            </div>
        `;
    }

    function buildMessageBubbleHtml(message) {
        const isOwn = isOwnMessage(message);
        const attachmentHtml = buildAttachmentHtml(message);
        const text = (message.text || '').trim();
        const showText = text && !isRedundantAttachmentCaption(text);
        const textBlock = showText ? `<div class="message-text">${escapeHtml(text)}</div>` : '';
        const timeLabel = isMessageEdited(message)
            ? `${formatTime(message.created_at)} · edited`
            : formatTime(message.created_at);

        return `
            <div class="message-bubble" data-message-id="${escapeHtml(message.id || '')}">
                ${!isOwn ? `<div class="message-author">${escapeHtml(message.user?.name || '')}</div>` : ''}
                ${textBlock}
                ${attachmentHtml}
                <div class="message-time">${timeLabel}</div>
            </div>
        `;
    }

    function buildMessageItemInnerHtml(message) {
        const isOwn = isOwnMessage(message);
        return buildMessageMenuHtml(message, isOwn) + buildMessageBubbleHtml(message);
    }

    function refreshMessageInDom(message) {
        if (!message?.id) {
            return;
        }
        const bubble = document.querySelector(`.message-bubble[data-message-id="${CSS.escape(message.id)}"]`);
        const item = bubble?.closest('.message-item');
        if (!item) {
            return;
        }
        closeAllMessageMenus();
        item.innerHTML = buildMessageItemInnerHtml(message);
    }

    function removeMessageFromDom(messageId) {
        if (!messageId) {
            return;
        }
        const bubble = document.querySelector(`.message-bubble[data-message-id="${CSS.escape(messageId)}"]`);
        if (!bubble) {
            return;
        }
        const item = bubble.closest('.message-item');
        if (item) {
            item.remove();
        }
        renderedMessageIds.delete(messageId);
    }

    function startEditMessage(messageId) {
        const message = getMessageById(messageId);
        if (!message || !canEditMessage(message)) {
            return;
        }
        const bubble = document.querySelector(`.message-bubble[data-message-id="${CSS.escape(messageId)}"]`);
        if (!bubble || bubble.classList.contains('is-editing')) {
            return;
        }
        const textEl = bubble.querySelector('.message-text');
        if (!textEl) {
            return;
        }
        const currentText = (message.text || '').trim();
        bubble.classList.add('is-editing');
        const menu = bubble.closest('.message-item')?.querySelector('.message-menu');
        if (menu) {
            menu.style.visibility = 'hidden';
        }
        const form = document.createElement('div');
        form.className = 'message-edit-form';
        const textarea = document.createElement('textarea');
        textarea.className = 'message-edit-input';
        textarea.rows = 3;
        textarea.maxLength = 5000;
        textarea.value = currentText;
        const actionsRow = document.createElement('div');
        actionsRow.className = 'message-edit-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-sm btn-light message-edit-cancel';
        cancelBtn.textContent = 'Cancel';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn btn-sm btn-primary message-edit-save';
        saveBtn.textContent = 'Save';
        actionsRow.append(cancelBtn, saveBtn);
        form.append(textarea, actionsRow);
        textEl.replaceWith(form);
        const input = bubble.querySelector('.message-edit-input');
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
        bubble.querySelector('.message-edit-cancel')?.addEventListener('click', () => {
            refreshMessageInDom(message);
        });
        bubble.querySelector('.message-edit-save')?.addEventListener('click', () => {
            saveEditedMessage(messageId);
        });
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveEditedMessage(messageId);
            }
            if (e.key === 'Escape') {
                refreshMessageInDom(message);
            }
        });
    }

    async function saveEditedMessage(messageId) {
        const message = getMessageById(messageId);
        const bubble = document.querySelector(`.message-bubble[data-message-id="${CSS.escape(messageId)}"]`);
        const input = bubble?.querySelector('.message-edit-input');
        if (!message || !input || !chatClient) {
            return;
        }
        const newText = input.value.trim();
        if (!newText) {
            chatAlert('Message cannot be empty.', 'warning');
            return;
        }
        if (newText === (message.text || '').trim()) {
            refreshMessageInDom(message);
            return;
        }
        try {
            await chatClient.updateMessage({
                id: messageId,
                text: newText,
            });
        } catch (error) {
            console.error('Error updating message:', error);
            chatAlert('Failed to update message. You may only edit your own messages.', 'error');
            refreshMessageInDom(message);
        }
    }

    async function deleteChatMessage(messageId) {
        const message = getMessageById(messageId);
        if (!message || !canDeleteMessage(message)) {
            return;
        }
        const confirmed = await chatConfirm('Delete this message? This cannot be undone.');
        if (!confirmed) {
            return;
        }
        try {
            await chatClient.deleteMessage(messageId);
            removeMessageFromDom(messageId);
            updateChannelListPreview();
        } catch (error) {
            console.error('Error deleting message:', error);
            chatAlert('Failed to delete message.', 'error');
        }
    }

    // Append single message
    function appendMessage(message) {
        const container = document.getElementById('messages-container');
        if (!container || !message.user) {
            return;
        }
        if (message.id && renderedMessageIds.has(message.id)) {
            refreshMessageInDom(message);
            return;
        }
        if (message.id) {
            renderedMessageIds.add(message.id);
        }
        const div = document.createElement('div');
        const isOwn = isOwnMessage(message);

        div.className = `message-item ${isOwn ? 'own' : ''}`;
        div.innerHTML = buildMessageItemInnerHtml(message);

        container.appendChild(div);
        scrollToBottom();
    }

    const messagesContainerEl = document.getElementById('messages-container');
    if (messagesContainerEl) {
        messagesContainerEl.addEventListener('click', (e) => {
            const trigger = e.target.closest('.message-menu-trigger');
            if (trigger) {
                e.stopPropagation();
                const menu = trigger.closest('.message-menu');
                const dropdown = menu?.querySelector('.message-menu-dropdown');
                const isOpen = menu?.classList.contains('open');
                closeAllMessageMenus();
                if (!isOpen && menu && dropdown) {
                    menu.classList.add('open');
                    dropdown.hidden = false;
                    trigger.setAttribute('aria-expanded', 'true');
                }
                return;
            }

            const item = e.target.closest('.message-menu-item');
            if (!item) {
                return;
            }
            e.stopPropagation();
            const menu = item.closest('.message-menu');
            const messageId = menu?.dataset.messageId;
            closeAllMessageMenus();
            if (!messageId) {
                return;
            }
            if (item.dataset.action === 'edit') {
                startEditMessage(messageId);
            } else if (item.dataset.action === 'delete') {
                deleteChatMessage(messageId);
            }
        });
    }

    document.addEventListener('click', () => {
        closeAllMessageMenus();
    });

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
                    chatAlert('Failed to send message', 'error');
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

            const picker = document.getElementById('members-select');
            if (!picker) {
                console.error('members-select element not found');
                return;
            }
            renderMemberPicker(picker, users, 'No users available');
        } catch (error) {
            console.error('Error loading users:', error);
            const picker = document.getElementById('members-select');
            if (picker) {
                picker.innerHTML = '<p class="chat-member-picker-empty text-muted mb-0">Error loading users</p>';
            }
        }
    }

    function renderMemberPicker(container, users, emptyMessage) {
        if (!container) {
            return;
        }
        container.innerHTML = '';
        if (!users.length) {
            container.innerHTML = `<p class="chat-member-picker-empty text-muted mb-0">${escapeHtml(emptyMessage)}</p>`;
            return;
        }
        users.forEach((user) => {
            const label = document.createElement('label');
            label.className = 'chat-member-picker-item';
            const formattedRole = formatRole(user.role, user.terminal, user.formatted_role);
            label.innerHTML = `
                <input type="checkbox" class="form-check-input" value="${escapeHtml(String(user.id))}">
                <span class="chat-member-picker-label">${escapeHtml(user.name)} <span class="text-muted">(${escapeHtml(formattedRole)})</span></span>
            `;
            container.appendChild(label);
        });
    }

    function getSelectedMemberIds(container) {
        if (!container) {
            return [];
        }
        return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => cb.value);
    }

    function clearMemberPicker(container) {
        if (!container) {
            return;
        }
        container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
            cb.checked = false;
        });
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
            const picker = document.getElementById('members-select');
            const selectedMembers = getSelectedMemberIds(picker);

            if (!channelName || selectedMembers.length === 0) {
                chatAlert('Please enter a channel name and select at least one member', 'warning');
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
                clearMemberPicker(document.getElementById('members-select'));

                // Reload channels
                await loadChannels();

                // Open the new channel
                const channel = chatClient.channel('messaging', channelId);
                await loadChannel(channel);

            } catch (error) {
                console.error('Error creating channel:', error);
                chatAlert(error.message || 'Failed to create channel', 'error');
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
            chatAlert('No channel selected', 'warning');
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

            const confirmed = await chatConfirm(confirmMessage);
            if (!confirmed) {
                return;
            }

            if (isCreator) {
                await currentChannel.delete();
                chatAlert('Channel has been permanently deleted', 'success');
            } else {
                await currentChannel.removeMembers([userId]);
                chatAlert('You have left the channel', 'success');
            }

            // Clear the chat area
            clearChatArea();

            // Reload channels list
            await loadChannels();

        } catch (error) {
            console.error('Error leaving channel:', error);
            chatAlert('Failed to leave channel: ' + error.message, 'error');
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
                chatAlert('No channel selected', 'warning');
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
                chatAlert('No channel selected', 'warning');
                return;
            }

            const picker = document.getElementById('new-members-select');
            const selectedMembers = getSelectedMemberIds(picker);

            if (selectedMembers.length === 0) {
                chatAlert('Please select at least one member to add', 'warning');
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
                clearMemberPicker(document.getElementById('new-members-select'));

                // Refresh channel to get updated member list
                await currentChannel.watch();

                // Update members display
                const memberCount = Object.keys(currentChannel.state.members).length;
                document.getElementById('channel-members').textContent = `${memberCount} members`;
                populateMembersList(currentChannel);

                chatAlert(`Successfully added ${selectedMembers.length} member(s) to the channel`, 'success');

            } catch (error) {
                console.error('Error adding members:', error);
                chatAlert('Failed to add members: ' + (error.message || error), 'error');
            }
        });
    }

    // Load available users (excluding current channel members, filtered by same terminal)
    async function loadAvailableUsers() {
        try {
            const users = await fetchJson('/chat/users');

            const picker = document.getElementById('new-members-select');
            if (!picker) {
                console.error('new-members-select element not found');
                return;
            }

            const currentMemberIds = currentChannel ?
                Object.keys(currentChannel.state.members) : [];

            const availableUsers = users.filter((user) =>
                !currentMemberIds.includes(String(user.id))
            );

            renderMemberPicker(
                picker,
                availableUsers,
                'All users from your terminal are already members'
            );
        } catch (error) {
            console.error('Error loading available users:', error);
            const picker = document.getElementById('new-members-select');
            if (picker) {
                picker.innerHTML = '<p class="chat-member-picker-empty text-muted mb-0">Error loading users</p>';
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
