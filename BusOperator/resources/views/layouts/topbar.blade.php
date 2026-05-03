<!-- topbar.blade.php -->
<div class="topbar bg-white shadow-sm py-2 px-4 d-flex justify-content-end align-items-center">
    <div class="user-info d-flex align-items-center gap-3">
        <!-- Notification Bell with Dropdown -->
        <div class="notification position-relative" id="notificationBellContainer">
            <button class="btn btn-link text-dark p-0" id="notificationBellBtn" style="font-size: 1.3rem; cursor: pointer;">
                <i class="fas fa-bell"></i>
            </button>
            <!-- The badge will be updated by JavaScript -->
            <div id="notificationBadge" class="badge bg-danger position-absolute top-0 start-100 translate-middle" style="display: none; font-size: 0.7rem; padding: 0.3rem 0.5rem;">0</div>
            
            <!-- Notification Dropdown -->
            <div id="notificationDropdown" class="notification-dropdown" style="display: none;">
                <div class="dropdown-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">Notifications</h6>
                    <button type="button" class="btn-close btn-sm" id="closeNotificationDropdown"></button>
                </div>
                <div class="dropdown-content" id="notificationDropdownContent">
                    <!-- Notifications will be loaded here by JS -->
                    <div class="text-center text-muted py-3">
                        <i class="fas fa-spinner fa-spin me-2"></i>Loading...
                    </div>
                </div>
                <div class="dropdown-footer">
                    <a href="{{ route('notifications.panel') }}" class="btn btn-sm btn-outline-primary w-100">
                        View All Notifications
                    </a>
                </div>
            </div>
        </div>
        
        @if(Auth::check())
            <div class="user-details text-end">
                <h4 class="mb-0">{{ Auth::user()->name }}</h4>
                <p class="mb-0">{{ ucfirst(Auth::user()->role) }}</p>
                <p class="mb-0 small text-muted">{{ Auth::user()->company_name ?? '' }}</p>
            </div>
        @endif

        <img src="{{ Auth::user()->photo_url ? asset('storage/' . Auth::user()->photo_url) : 'https://randomuser.me/api/portraits/men/32.jpg' }}" alt="User" class="rounded-circle" style="width:40px;height:40px;object-fit:cover;">

    </div>
</div>

<!-- Notification Dropdown Styles -->
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

    .dropdown-header {
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
        background-color: #f8f9fa;
    }

    .dropdown-header h6 {
        color: #333;
        font-weight: 600;
    }

    .dropdown-content {
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
        margin-left: 8px;
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

    .dropdown-footer {
        padding: 12px 16px;
        border-top: 1px solid #e0e0e0;
        background-color: #f8f9fa;
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

<!-- Add this script at the bottom of the file or in a separate JS file -->
<script>
document.addEventListener('DOMContentLoaded', function () {
    const notificationBellBtn = document.getElementById('notificationBellBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const closeNotificationDropdown = document.getElementById('closeNotificationDropdown');
    let isDropdownOpen = false;

    // Toggle dropdown on bell click
    notificationBellBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isDropdownOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });

    // Close dropdown on close button click
    closeNotificationDropdown.addEventListener('click', function() {
        closeDropdown();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        if (isDropdownOpen) {
            closeDropdown();
        }
    });

    // Prevent closing when clicking inside dropdown
    notificationDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    function openDropdown() {
        notificationDropdown.style.display = 'block';
        isDropdownOpen = true;
        loadRecentNotifications();
    }

    function closeDropdown() {
        notificationDropdown.style.display = 'none';
        isDropdownOpen = false;
    }

    function loadRecentNotifications() {
        const content = document.getElementById('notificationDropdownContent');
        content.innerHTML = '<div class="text-center text-muted py-3"><i class="fas fa-spinner fa-spin me-2"></i>Loading...</div>';

        fetch('/notifications/recent', {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
            }
        })
        .then(response => response.json())
        .then(data => {
            if (!data.notifications || data.notifications.length === 0) {
                content.innerHTML = '<div class="text-center text-muted py-4"><p><i class="fas fa-inbox me-2"></i>No notifications yet</p></div>';
                return;
            }

            let html = '';
            data.notifications.forEach(notif => {
                const unreadClass = notif.is_read ? '' : 'unread';
                const typeLabel = notif.type.replace('_', ' ').toUpperCase();
                
                html += `
                    <div class="notification-item ${unreadClass}" onclick="location.href='{{ route('notifications.panel') }}'">
                        <div class="notification-item-header">
                            <span class="notification-item-title">${escapeHtml(notif.from_label || notif.driver_name || 'System')}</span>
                            <span class="notification-item-type">${typeLabel}</span>
                        </div>
                        <div class="notification-item-message">${escapeHtml(notif.short_message)}</div>
                        <div class="notification-item-time"><i class="far fa-clock me-1"></i>${notif.created_at}</div>
                    </div>
                `;
            });

            content.innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading recent notifications:', error);
            content.innerHTML = '<div class="text-center text-danger py-3">Error loading notifications</div>';
        });
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Function to update the notification badge
    function updateNotificationBadge() {
        fetch('/notifications/unread-count', {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
            }
        })
        .then(response => response.json())
        .then(data => {
            const badge = document.getElementById('notificationBadge');
            if (data.count > 0) {
                badge.textContent = data.count > 99 ? '99+' : data.count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error fetching notification count:', error);
            document.getElementById('notificationBadge').style.display = 'none';
        });
    }

    // Call it on page load and then every 5 seconds (same as notifications.js)
    updateNotificationBadge();
    setInterval(updateNotificationBadge, 5000);
});
</script>