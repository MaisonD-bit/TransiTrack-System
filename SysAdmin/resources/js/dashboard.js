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
});

window.redirectTo = redirectTo;
window.refreshDashboard = refreshDashboard;
