<div class="topbar bg-white shadow-sm py-2 px-4 d-flex justify-content-between align-items-center">
    <div class="text-muted small">
        TransiTrack central approvals — route pathways &amp; bus stops
    </div>
    @auth('sysadmin')
        <div class="d-flex align-items-center gap-3">
            <div class="text-end">
                <div class="fw-semibold">{{ Auth::guard('sysadmin')->user()->name }}</div>
                <div class="small text-muted">{{ Auth::guard('sysadmin')->user()->email }}</div>
            </div>
            <span class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width:40px;height:40px;">
                <i class="fas fa-user-shield"></i>
            </span>
        </div>
    @endauth
</div>
