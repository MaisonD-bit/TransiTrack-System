/**
 * Notification System for Bus Operator
 * Handles real-time notification updates, badge counts, and alerts
 */

let lastNotificationCount = 0;
let notificationCheckInterval = null;

// Initialize notification system when document is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeNotifications();
});

/**
 * Initialize the notification system
 */
function initializeNotifications() {
    console.log('Initializing notification system...');
    
    // Initial check
    updateNotificationBadge();
    
    // Start polling for new notifications every 5 seconds
    notificationCheckInterval = setInterval(updateNotificationBadge, 5000);
    
    // Also listen for visibility changes (update when tab becomes visible)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            console.log('Tab became visible, checking notifications...');
            updateNotificationBadge();
        }
    });
    
    console.log('Notification system initialized');
}

/**
 * Update the notification badge with unread count
 */
async function updateNotificationBadge() {
    try {
        const response = await fetch('/notifications/unread-count', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            console.warn('Failed to fetch notification count:', response.status);
            return;
        }

        const data = await response.json();
        const unreadCount = data.count || data.unread_count || 0;

        console.log('Current unread notifications:', unreadCount);

        // Update badge display
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'inline-block';
                // New items are indicated only by the bell badge (no popup toast)
            } else {
                badge.style.display = 'none';
            }
        }

        lastNotificationCount = unreadCount;

    } catch (error) {
        console.error('Error updating notification badge:', error);
    }
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notificationId) {
    try {
        const response = await fetch(`/notifications/${notificationId}/read`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (response.ok) {
            console.log('Notification marked as read:', notificationId);
            updateNotificationBadge();
            return true;
        } else {
            console.error('Failed to mark notification as read');
            return false;
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return false;
    }
}

/**
 * Mark all notifications as read
 */
async function markAllNotificationsAsRead() {
    try {
        const response = await fetch('/notifications/mark-all-read', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (response.ok) {
            console.log('All notifications marked as read');
            updateNotificationBadge();
            return true;
        } else {
            console.error('Failed to mark all notifications as read');
            return false;
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return false;
    }
}

/**
 * Delete all notifications
 */
async function deleteAllNotifications() {
    if (!confirm('Are you sure you want to delete all notifications?')) {
        return false;
    }

    try {
        const response = await fetch('/notifications/clear-all', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (response.ok) {
            console.log('All notifications deleted');
            updateNotificationBadge();
            location.reload();
            return true;
        } else {
            console.error('Failed to delete all notifications');
            return false;
        }
    } catch (error) {
        console.error('Error deleting all notifications:', error);
        return false;
    }
}

/**
 * Handle incoming chat message notification
 */
function handleChatMessageNotification(message) {
    updateNotificationBadge();
}

/**
 * Handle incoming driver report notification
 */
function handleDriverReportNotification(report) {
    updateNotificationBadge();
}

/**
 * Handle incoming announcement notification
 */
function handleAnnouncementNotification(announcement) {
    updateNotificationBadge();
}

/**
 * Cleanup notification system
 */
function cleanupNotifications() {
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
        console.log('Notification polling stopped');
    }
}

// Cleanup when page unloads
window.addEventListener('beforeunload', cleanupNotifications);

// Bell badge emphasis (unread count)
const style = document.createElement('style');
style.textContent = `
    #notificationBadge {
        background-color: #dc3545 !important;
        color: white !important;
        font-weight: bold;
        min-width: 18px;
        text-align: center;
    }
`;
document.head.appendChild(style);
