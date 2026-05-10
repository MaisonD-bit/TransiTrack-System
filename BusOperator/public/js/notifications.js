/**
 * Bus operator panel: bell badge + soft reload when server data changes.
 * Trip Logs and Schedule use their own polls; we skip full page reload there.
 */

let lastNotificationCount = 0;
let operatorSyncInterval = null;
let lastSyncToken = null;

const OPERATOR_SYNC_URL = '/panel/operator-sync';
const SYNC_POLL_MS = 12000;

function shouldSkipAutoReloadForPath(pathname) {
    if (!pathname) {
        return false;
    }
    return pathname.includes('/panel/trips') || pathname.includes('/panel/schedule');
}

function applyUnreadBadge(count) {
    const unreadCount = Number(count) || 0;
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
    lastNotificationCount = unreadCount;
}

async function pollOperatorSync(options) {
    const badgeOnly = options && options.badgeOnly === true;
    try {
        const response = await fetch(OPERATOR_SYNC_URL, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json();
        if (!data.success) {
            return;
        }

        const unread = data.unread_notifications ?? data.count ?? 0;
        applyUnreadBadge(unread);

        if (badgeOnly) {
            return;
        }

        const token = data.sync_token;
        if (typeof token !== 'string') {
            return;
        }

        if (lastSyncToken === null) {
            lastSyncToken = token;
            return;
        }

        if (token !== lastSyncToken) {
            lastSyncToken = token;
            const path = window.location.pathname || '';
            if (shouldSkipAutoReloadForPath(path)) {
                return;
            }
            window.location.reload();
        }
    } catch (e) {
        console.warn('Operator sync poll failed', e);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    pollOperatorSync({ badgeOnly: false });
    operatorSyncInterval = setInterval(function () {
        pollOperatorSync({ badgeOnly: false });
    }, SYNC_POLL_MS);

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            pollOperatorSync({ badgeOnly: false });
        }
    });
});

async function updateNotificationBadge() {
    await pollOperatorSync({ badgeOnly: true });
}

async function markNotificationAsRead(notificationId) {
    try {
        const response = await fetch('/notifications/' + notificationId + '/read', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });

        if (response.ok) {
            await updateNotificationBadge();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return false;
    }
}

async function markAllNotificationsAsRead() {
    try {
        const response = await fetch('/notifications/mark-all-read', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });

        if (response.ok) {
            await updateNotificationBadge();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return false;
    }
}

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
                'X-Requested-With': 'XMLHttpRequest',
            },
        });

        if (response.ok) {
            await updateNotificationBadge();
            location.reload();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting all notifications:', error);
        return false;
    }
}

function handleChatMessageNotification() {
    updateNotificationBadge();
}

function handleDriverReportNotification() {
    updateNotificationBadge();
}

function handleAnnouncementNotification() {
    updateNotificationBadge();
}

function cleanupNotifications() {
    if (operatorSyncInterval) {
        clearInterval(operatorSyncInterval);
        operatorSyncInterval = null;
    }
}

window.addEventListener('beforeunload', cleanupNotifications);

const style = document.createElement('style');
style.textContent = `
    #notificationBadge {
        background-color: #dc3545 !important;
        color: white !important;
        font-weight: bold;
        text-align: center;
    }
`;
document.head.appendChild(style);
