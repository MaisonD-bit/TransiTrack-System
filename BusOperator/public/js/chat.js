const {
    StreamChat
} = window;

let chatClient;
let currentChannel;
let channels = [];
let displayedMessageIds = new Set(); // Track displayed message IDs to prevent duplicates
let channelMessageHandler = null;
let channelMessageUpdatedHandler = null;
let channelMessageDeletedHandler = null;

async function chatConfirm(message, confirmLabel = 'Confirm', cancelLabel = 'Cancel') {
    if (typeof showSpaceConfirm === 'function') {
        return showSpaceConfirm(message, confirmLabel, cancelLabel);
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
    return message.user && String(message.user.id) === String(window.userId);
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
    if (!text) {
        return false;
    }
    return !shouldSuppressRedundantAttachmentCaption(text, message.attachments);
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

function getChannelDisplayName(channel) {
    const explicit = (channel?.data?.name || '').trim();
    if (explicit) {
        return explicit;
    }

    const members = channel?.state?.members ? Object.values(channel.state.members) : [];
    const otherNames = members
        .filter((member) => member.user_id && String(member.user_id) !== String(window.userId))
        .map((member) => (member.user?.name || '').trim())
        .filter(Boolean);

    if (otherNames.length === 1) {
        return otherNames[0];
    }
    if (otherNames.length > 1) {
        return otherNames.join(', ');
    }

    const channelId = String(channel?.id || '');
    const driverMatch = channelId.match(/^driver(\d+)-op/i);
    if (driverMatch) {
        return `Driver #${driverMatch[1]}`;
    }

    return 'Unnamed Channel';
}

function updateChannelListItemName(channel) {
    const channelItem = document.querySelector(`[data-channel-id="${channel.id}"]`);
    const nameEl = channelItem?.querySelector('.channel-name');
    if (nameEl) {
        nameEl.textContent = getChannelDisplayName(channel);
    }
}

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
            const lastMessageText = channelPreviewText(lastMessage);

            channelDiv.innerHTML = `
                <div class="channel-content">
                    <div class="channel-name">${escapeHtml(getChannelDisplayName(channel))}</div>
                    <div class="channel-last-message">${escapeHtml(lastMessageText)}</div>
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
        document.getElementById('channel-name').textContent = getChannelDisplayName(channel);

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
        updateChannelListItemName(channel);
        document.getElementById('channel-name').textContent = getChannelDisplayName(channel);
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

/** Hide caption line when it only repeats the attachment filename (legacy sends used 📎/📷 + name). */
function shouldSuppressRedundantAttachmentCaption(textTrim, attachments) {
    if (!textTrim || !attachments || attachments.length === 0) {
        return false;
    }
    for (const att of attachments) {
        if (att.type === 'file') {
            const fn = att.title || att.fallback || '';
            if (fn && (textTrim === '📎 ' + fn || textTrim === fn)) {
                return true;
            }
        }
        if (att.type === 'image') {
            const fb = att.fallback || '';
            if (textTrim === '📷 Image') {
                return true;
            }
            if (fb && (textTrim === '📷 ' + fb || textTrim === fb)) {
                return true;
            }
        }
    }
    return false;
}

function resolveChatMediaUrl(url) {
    if (!url || typeof url !== 'string') {
        return '';
    }
    const trimmed = url.trim();
    if (!trimmed || /^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    const boBase = (window.busOperatorAppUrl || window.location.origin || '').replace(/\/$/, '');
    const tmBase = (window.terminalManagerAppUrl || 'http://localhost:8001').replace(/\/$/, '');
    if (trimmed.startsWith('/storage/')) {
        return boBase + trimmed;
    }
    if (trimmed.startsWith('storage/')) {
        return boBase + '/' + trimmed;
    }
    if (trimmed.startsWith('operators/') || trimmed.startsWith('drivers/')) {
        return boBase + '/storage/' + trimmed;
    }
    if (trimmed.startsWith('managers/')) {
        return tmBase + '/storage/' + trimmed;
    }
    return boBase + '/storage/' + trimmed.replace(/^\//, '');
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
            attachmentHtml += `<div class="message-attachment"><i class="bi bi-file-earmark"></i><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" download="${escapeHtml(fileName)}">${escapeHtml(fileName)}</a></div>`;
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
    const rawText = message.text || '';
    const textTrim = rawText.trim();
    const suppressText = shouldSuppressRedundantAttachmentCaption(textTrim, message.attachments);
    const textBlock = textTrim && !suppressText
        ? `<div class="message-text">${escapeHtml(rawText)}</div>`
        : '';
    const timeLabel = isMessageEdited(message)
        ? `${formatTime(message.created_at)} · edited`
        : formatTime(message.created_at);

    return `
        <div class="message-bubble" data-message-id="${escapeHtml(message.id || '')}">
            ${!isOwn ? `<div class="message-author">${escapeHtml(message.user?.name || '')}</div>` : ''}
            ${textBlock}
            ${buildAttachmentHtml(message)}
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
    displayedMessageIds.delete(messageId);
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

function appendMessage(message) {
    const container = document.getElementById('messages-container');
    if (!container || !message.user) {
        return;
    }
    if (message.id && displayedMessageIds.has(message.id)) {
        refreshMessageInDom(message);
        return;
    }
    if (message.id) {
        displayedMessageIds.add(message.id);
    }
    const div = document.createElement('div');
    const isOwn = isOwnMessage(message);

    div.className = `message-item ${isOwn ? 'own' : ''}`;
    div.dataset.messageId = message.id || '';
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
            chatAlert('Failed to send message', 'error');
        }
    }
});

function channelPreviewText(lastMessage) {
    if (!lastMessage) {
        return 'No messages yet';
    }
    const t = String(lastMessage.text || '').trim();
    const atts = lastMessage.attachments;
    if (atts && atts.length && shouldSuppressRedundantAttachmentCaption(t, atts)) {
        const a = atts[0];
        if (a.type === 'image') {
            return '📷 Image';
        }
        if (a.type === 'file') {
            return 'Attachment';
        }
    }
    if (t) {
        return t.length > 60 ? t.slice(0, 60) + '…' : t;
    }
    if (atts && atts.length) {
        const a = atts[0];
        if (a.type === 'image') {
            return 'Image';
        }
        if (a.type === 'file') {
            return 'Attachment';
        }
        if (a.type === 'link') {
            return '🔗 Link';
        }
    }
    return 'Message';
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
            text: '',
            attachments: [{
                type: 'image',
                image_url: imageUrl,
                fallback: file.name || 'Image',
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
            text: '',
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

document.getElementById('image-btn').addEventListener('click', () => {
    document.getElementById('image-input').click();
});

document.getElementById('image-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && currentChannel) {
        await uploadAndSendImage(file);
    }
    e.target.value = '';
});

document.getElementById('file-btn').addEventListener('click', () => {
    document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && currentChannel) {
        await uploadAndSendFile(file);
    }
    e.target.value = '';
});

// Load users for channel creation
async function loadUsers() {
    try {
        const response = await fetch('/chat/users');
        const users = await response.json();

        const picker = document.getElementById('members-select');
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
document.getElementById('createChannelBtn').addEventListener('click', () => {
    const modal = new bootstrap.Modal(document.getElementById('createChannelModal'));
    modal.show();
});

// Create channel submit
document.getElementById('create-channel-submit').addEventListener('click', async () => {
    const channelName = document.getElementById('channel-name-input').value;
    const picker = document.getElementById('members-select');
    const selectedMembers = getSelectedMemberIds(picker);

    if (!channelName || selectedMembers.length === 0) {
        chatAlert('Please enter a channel name and select at least one member', 'warning');
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
        chatAlert(`Channel "${channelName}" created successfully! Note: You (the creator) have been automatically added to the channel.`, 'success');

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
        chatAlert('No channel selected', 'warning');
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

        const confirmed = await chatConfirm(confirmMessage);
        if (!confirmed) {
            return;
        }

        if (isCreator) {
            await currentChannel.delete();
            chatAlert('Channel has been permanently deleted', 'success');
        } else {
            await currentChannel.removeMembers([window.userId]);
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
        chatAlert('No channel selected', 'warning');
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
        chatAlert('Failed to add members: ' + error.message, 'error');
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

        const picker = document.getElementById('new-members-select');

        // Get current channel member IDs
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
            picker.innerHTML = `<p class="chat-member-picker-empty text-muted mb-0">Error loading users: ${escapeHtml(error.message)}</p>`;
        }
        chatAlert('Failed to load available users: ' + error.message, 'error');
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
