<div class="topbar bg-white shadow-sm py-2 px-4 d-flex justify-content-end align-items-center">
    <div class="user-info d-flex align-items-center gap-3">
        <div class="notification position-relative" id="notificationBellContainer">
            <button class="btn btn-link text-dark p-0" id="notificationBellBtn" type="button" style="font-size: 1.3rem; cursor: pointer;">
                <i class="fas fa-bell"></i>
            </button>
            <span id="notificationBadge" class="badge bg-danger rounded-pill position-absolute top-0 start-100 translate-middle" style="display: none; font-size: 0.65rem; min-width: 1.1rem; padding: 0.2rem 0.45rem; line-height: 1.1; z-index: 2;">0</span>

            <div id="notificationDropdown" class="notification-dropdown" style="display: none;">
                <div class="notification-dropdown-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Notifications</h6>
                    <button type="button" class="btn-close btn-sm" id="closeNotificationDropdown" aria-label="Close"></button>
                </div>
                <div class="notification-dropdown-content" id="notificationDropdownContent">
                    <div class="text-center text-muted py-3">
                        <i class="fas fa-spinner fa-spin me-2"></i>Loading...
                    </div>
                </div>
            </div>
        </div>

        @if(Auth::check())
        <div class="user-details text-end">
            <h4 class="mb-0">{{ Auth::user()->name }}</h4>
            <p class="mb-0">{{ ucfirst(Auth::user()->formatted_role) }}</p>
            <p class="mb-0 small text-muted">{{ Auth::user()->company_name ?? '' }}</p>
        </div>
        <img src="{{ Auth::user()->photo_url ? asset('storage/' . Auth::user()->photo_url) : 'https://randomuser.me/api/portraits/men/32.jpg' }}" alt="User" class="rounded-circle" style="width:40px;height:40px;object-fit:cover;">
        @else
        <div class="user-details text-end">
            <h4 class="mb-0 text-muted">Guest</h4>
            <p class="mb-0 text-muted">Not logged in</p>
        </div>
        @endif
    </div>
</div>

<style>
    #notificationBellContainer {
        position: relative;
    }

    #notificationBellBtn {
        transition: color 0.2s ease;
    }

    #notificationBellBtn:hover {
        color: #0066cc !important;
    }

    .notification-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        width: 350px;
        max-width: 90vw;
        margin-top: 10px;
        z-index: 1050;
        overflow: hidden;
    }

    .notification-dropdown-header {
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
        background-color: #f8f9fa;
    }

    .notification-dropdown-header h6 {
        color: #333;
        font-weight: 600;
    }

    .notification-dropdown-content {
        max-height: 350px;
        overflow-y: auto;
    }

    .notification-item {
        padding: 12px 16px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .notification-item:hover {
        background-color: #f8f9fa;
    }

    .notification-item.unread {
        background-color: #e3f2fd;
    }

    .notification-item-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 6px;
        gap: 8px;
    }

    .notification-item-title {
        font-weight: 600;
        color: #333;
        font-size: 0.95rem;
        flex: 1;
    }

    .notification-item-type {
        display: inline-block;
        padding: 2px 8px;
        background-color: #e3f2fd;
        color: #1976d2;
        border-radius: 3px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
        flex-shrink: 0;
    }

    .notification-item-message {
        color: #666;
        font-size: 0.9rem;
        margin-bottom: 6px;
        line-height: 1.4;
        word-wrap: break-word;
    }

    .notification-item-time {
        color: #999;
        font-size: 0.85rem;
    }

    .notification-dropdown::-webkit-scrollbar {
        width: 6px;
    }

    .notification-dropdown::-webkit-scrollbar-track {
        background: #f1f1f1;
    }

    .notification-dropdown::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 3px;
    }

    .notification-dropdown::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
</style>

<script>
let notificationCheckInterval;

document.addEventListener('DOMContentLoaded', function () {
    const notificationBellBtn = document.getElementById('notificationBellBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const closeNotificationDropdown = document.getElementById('closeNotificationDropdown');
    let isDropdownOpen = false;

    if (!notificationBellBtn || !notificationDropdown || !closeNotificationDropdown) {
        return;
    }

    notificationBellBtn.addEventListener('click', function (event) {
        event.stopPropagation();

        if (isDropdownOpen) {
            closeDropdown();
            return;
        }

        openDropdown();
    });

    closeNotificationDropdown.addEventListener('click', function () {
        closeDropdown();
    });

    document.addEventListener('click', function () {
        if (isDropdownOpen) {
            closeDropdown();
        }
    });

    notificationDropdown.addEventListener('click', function (event) {
        event.stopPropagation();
    });

    function openDropdown() {
        notificationDropdown.style.display = 'block';
        isDropdownOpen = true;
        fetchNotifications();
    }

    function closeDropdown() {
        notificationDropdown.style.display = 'none';
        isDropdownOpen = false;
    }

    startNotificationPolling();
});

async function fetchNotifications() {
    const content = document.getElementById('notificationDropdownContent');

    try {
        const response = await fetch('/notifications', {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
            }
        });
        const data = await response.json();

        updateNotificationCount(data.unread_count || 0);
        displayNotifications(data.notifications || []);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        if (content) {
            content.innerHTML = '<div class="text-center text-danger py-3">Error loading notifications</div>';
        }
    }
}

function updateNotificationCount(count) {
    const badge = document.getElementById('notificationBadge');
    if (!badge) {
        return;
    }

    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

function displayNotifications(notifications) {
    const content = document.getElementById('notificationDropdownContent');
    if (!content) {
        return;
    }

    if (notifications.length === 0) {
        content.innerHTML = '<div class="text-center text-muted py-4"><p><i class="fas fa-inbox me-2"></i>No notifications yet</p></div>';
        return;
    }

    content.innerHTML = notifications.map(notification => {
        const data = notification.data || {};
        const isUnread = !notification.read_at;
        const typeLabel = getNotificationTypeLabel(notification);
        const title = data.subject || getNotificationTitle(notification);
        const message = data.message || 'Notification';
        const actionUrl = getNotificationActionUrl(notification);
        const timeAgo = formatTimeAgo(notification.created_at);

        return `
            <div class="notification-item ${isUnread ? 'unread' : ''}" onclick="handleNotificationClick('${escapeJs(notification.id)}', '${escapeJs(actionUrl)}')">
                <div class="notification-item-header">
                    <span class="notification-item-title">${escapeHtml(title)}</span>
                    <span class="notification-item-type">${escapeHtml(typeLabel)}</span>
                </div>
                <div class="notification-item-message">${escapeHtml(message)}</div>
                <div class="notification-item-time"><i class="far fa-clock me-1"></i>${escapeHtml(timeAgo)}</div>
            </div>
        `;
    }).join('');
}

async function handleNotificationClick(notificationId, actionUrl) {
    try {
        if (!String(notificationId).startsWith('approval-')) {
            await fetch(`/notifications/${notificationId}/read`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Content-Type': 'application/json'
                }
            });

            await fetchNotifications();
        }

        if (actionUrl) {
            window.location.href = actionUrl;
        }
    } catch (error) {
        console.error('Error handling notification:', error);
    }
}

function getNotificationTypeLabel(notification) {
    if (notification.type === 'pending_approval') {
        return 'Approval';
    }

    const data = notification.data || {};
    if (data.announcement_id) {
        return 'Announcement';
    }

    if (data.message_id) {
        return 'Message';
    }

    return 'Notification';
}

function getNotificationTitle(notification) {
    if (notification.type === 'pending_approval') {
        return 'Pending bus operator approval';
    }

    return 'System';
}

function getNotificationActionUrl(notification) {
    const data = notification.data || {};

    if (data.action_url) {
        return data.action_url;
    }

    if (data.announcement_id) {
        return `/announcements/${data.announcement_id}`;
    }

    return '';
}

function formatTimeAgo(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return 'Just now';
    }

    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
}

function escapeJs(text) {
    return String(text ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function startNotificationPolling() {
    fetchNotifications();
    clearInterval(notificationCheckInterval);
    notificationCheckInterval = setInterval(fetchNotifications, 30000);
}
</script>
