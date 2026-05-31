function redirectTo(url) {
    window.location.href = url;
}

function refreshDashboard() {
    window.location.reload();
}

function filterDecisions() {
    const filter = document.getElementById('decisionFilter')?.value || '';
    const rows = document.querySelectorAll('#decisionsTable tbody tr');
    rows.forEach((row) => {
        const status = row.dataset.status || '';
        row.style.display = !filter || status === filter ? '' : 'none';
    });
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = String(value);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('decisionFilter')?.addEventListener('change', filterDecisions);

    document.querySelectorAll('.dashboard-card').forEach((card) => {
        card.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-5px)';
        });
        card.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0)';
        });
    });

    const dashRoot = document.querySelector('[data-dashboard-poll-url]');
    const pollUrl = dashRoot?.dataset.dashboardPollUrl;
    if (!pollUrl) {
        return;
    }

    let lastSignature = dashRoot.dataset.dashboardPollSignature || '';

    async function pollDashboard() {
        try {
            const res = await fetch(pollUrl, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            if (!res.ok) {
                return;
            }
            const data = await res.json();
            if (data.signature === lastSignature) {
                return;
            }
            lastSignature = data.signature;

            setText('dash-stat-pending-routes', data.pending_route_count);
            setText('dash-stat-pending-managers', data.pending_manager_count);
            setText('dash-stat-pending-stops', data.pending_stops_count);
            setText('dash-stat-decisions-today', data.decisions_today);

            const pendingTbody = document.getElementById('dash-pending-queue-tbody');
            if (pendingTbody && data.pending_queue_html) {
                pendingTbody.innerHTML = data.pending_queue_html;
            }

            const recentTbody = document.getElementById('dash-recent-decisions-tbody');
            if (recentTbody && data.recent_decisions_html) {
                recentTbody.innerHTML = data.recent_decisions_html;
                filterDecisions();
            }

            const terminalBadges = document.getElementById('dash-terminal-badges');
            if (terminalBadges && data.terminal_badges_html) {
                terminalBadges.innerHTML = data.terminal_badges_html;
            }
        } catch {
            /* ignore transient network errors */
        }
    }

    setInterval(pollDashboard, 4000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            pollDashboard();
        }
    });
    pollDashboard();
});

window.redirectTo = redirectTo;
window.refreshDashboard = refreshDashboard;
