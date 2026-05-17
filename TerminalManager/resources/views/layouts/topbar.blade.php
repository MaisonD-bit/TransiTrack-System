<div class="topbar bg-white shadow-sm py-2 px-4 d-flex justify-content-end align-items-center">
    <div class="user-info d-flex align-items-center gap-3">
        <div class="notification position-relative dropdown">
            <button class="btn btn-link text-decoration-none p-0" type="button" id="notificationDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="fas fa-bell fs-5 text-dark"></i>
                <span class="badge bg-danger position-absolute top-0 start-100 translate-middle rounded-pill" id="notification-count" style="display: none;">0</span>
            </button>
            <div class="dropdown-menu dropdown-menu-end shadow-lg border-0" aria-labelledby="notificationDropdown" style="width: 380px; max-height: 500px; overflow-y: auto;">
                <div class="dropdown-header d-flex justify-content-between align-items-center bg-light py-3">
                    <h6 class="mb-0 fw-bold">Notifications</h6>
                    <button class="btn btn-sm btn-link text-decoration-none p-0" id="mark-all-read">
                        <small>Mark all as read</small>
                    </button>
                </div>
                <div id="notifications-list">
                    <div class="text-center py-4 text-muted">
                        <i class="fas fa-bell-slash fs-1 opacity-25"></i>
                        <p class="mt-2 small">No notifications</p>
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
.notification-item {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
    transition: background-color 0.2s;
    cursor: pointer;
}

.notification-item:hover {
    background-color: #f8f9fa;
}

.notification-item.unread {
    background-color: #e7f3ff;
}

.notification-item .notification-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
}

.notification-item .notification-content {
    flex: 1;
}

.notification-item .notification-message {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 4px;
    color: #333;
}

.notification-item .notification-time {
    font-size: 12px;
    color: #6c757d;
}

.notification-item .delete-notification {
    opacity: 0;
    transition: opacity 0.2s;
}

.notification-item:hover .delete-notification {
    opacity: 1;
}
</style>

<script>
let notificationCheckInterval;

// Fetch and display notifications
async function fetchNotifications() {
    try {
        const response = await fetch('/notifications');
        const data = await response.json();
        
        updateNotificationCount(data.unread_count);
        displayNotifications(data.notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
    }
}

// Update notification count badge
function updateNotificationCount(count) {
    const badge = document.getElementById('notification-count');
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

// Display notifications in dropdown
function displayNotifications(notifications) {
    const list = document.getElementById('notifications-list');
    
    if (notifications.length === 0) {
        list.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="fas fa-bell-slash fs-1 opacity-25"></i>
                <p class="mt-2 small">No notifications</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = notifications.map(notification => {
        const data = notification.data;
        const isUnread = !notification.read_at;
        const timeAgo = formatTimeAgo(notification.created_at);
        
        return `
            <div class="notification-item d-flex align-items-start gap-3 ${isUnread ? 'unread' : ''}" 
                 data-id="${notification.id}"
                 onclick="handleNotificationClick('${notification.id}', '${data.announcement_id || ''}')">
                <div class="notification-icon bg-primary bg-opacity-10 text-primary">
                    <i class="fas fa-envelope"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-message">${escapeHtml(data.message)}</div>
                    ${data.subject ? `<div class="text-muted small">${escapeHtml(data.subject)}</div>` : ''}
                    <div class="notification-time">${timeAgo}</div>
                </div>
                ${isUnread ? '<span class="badge bg-primary rounded-circle p-1" style="width: 8px; height: 8px;"></span>' : ''}
                <button class="btn btn-sm btn-link text-danger delete-notification p-0" 
                        onclick="event.stopPropagation(); deleteNotification('${notification.id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

// Handle notification click
async function handleNotificationClick(notificationId, announcementId) {
    try {
        // Mark as read
        await fetch(`/notifications/${notificationId}/read`, {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                'Content-Type': 'application/json'
            }
        });
        
        // Refresh notifications
        await fetchNotifications();
        
        // Navigate to announcement if available
        if (announcementId) {
            window.location.href = `/announcements/${announcementId}`;
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Delete notification
async function deleteNotification(notificationId) {
    try {
        await fetch(`/notifications/${notificationId}`, {
            method: 'DELETE',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                'Content-Type': 'application/json'
            }
        });
        
        await fetchNotifications();
    } catch (error) {
        console.error('Error deleting notification:', error);
    }
}

// Mark all as read
document.getElementById('mark-all-read')?.addEventListener('click', async () => {
    try {
        await fetch('/notifications/mark-all-read', {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                'Content-Type': 'application/json'
            }
        });
        
        await fetchNotifications();
    } catch (error) {
        console.error('Error marking all as read:', error);
    }
});

// Format time ago
function formatTimeAgo(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Check for new notifications every 30 seconds
function startNotificationPolling() {
    fetchNotifications();
    notificationCheckInterval = setInterval(fetchNotifications, 30000);
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startNotificationPolling);
} else {
    startNotificationPolling();
}
</script>
