<div class="sidebar">
    <div class="logo">
        <i class="fas fa-user-shield fa-2x me-2"></i>
        <div>
            <h1 class="mb-0">TransiTrack</h1>
            <small class="text-white-50">Sysadmin</small>
        </div>
    </div>
    <div class="nav-links">
        <a href="{{ route('sysadmin.dashboard') }}" class="nav-item {{ request()->routeIs('sysadmin.dashboard') ? 'active' : '' }}">
            <i class="fas fa-home"></i>
            <span>Dashboard</span>
        </a>
        <a href="{{ route('sysadmin.approvals') }}" class="nav-item {{ request()->routeIs('sysadmin.approvals') ? 'active' : '' }}">
            <i class="fas fa-check-double"></i>
            <span>Route approvals</span>
        </a>
        <form action="{{ route('sysadmin.logout') }}" method="POST" class="mt-4 px-3">
            @csrf
            <button type="submit" class="btn btn-outline-light btn-sm w-100">
                <i class="fas fa-sign-out-alt me-1"></i> Logout
            </button>
        </form>
    </div>
</div>
