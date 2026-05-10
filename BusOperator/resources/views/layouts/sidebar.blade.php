<div class="sidebar">
    <div class="logo">
        <img src="{{ asset('images/transitrack_logo.png') }}" alt="TransiTrack Logo" class="logo-img">
        <h1>TransiTrack</h1>
    </div>
    <div class="nav-links">
        <a href="{{ route('operator.panel') }}" class="nav-item {{ request()->routeIs('operator.panel') ? 'active' : '' }}">
            <i class="fas fa-tachometer-alt"></i>
            <span>Operator Panel</span>
        </a>
        <a href="{{ route('notifications.panel') }}" class="nav-item {{ request()->routeIs('notifications.panel') ? 'active' : '' }}">
            <i class="fas fa-bell"></i>
            <span>Notifications</span>
        </a>
        <a href="{{ route('schedule.panel') }}" class="nav-item {{ request()->routeIs('schedule.panel') ? 'active' : '' }}">
            <i class="fas fa-calendar-alt"></i>
            <span>Schedule</span>
        </a>
        <a href="{{ route('trips.panel') }}" class="nav-item {{ request()->routeIs('trips.panel') ? 'active' : '' }}">
            <i class="fas fa-clipboard-list"></i>
            <span>Trip Logs</span>
        </a>
        <a href="{{ route('route-requests.panel') }}" class="nav-item {{ request()->routeIs('route-requests.*') ? 'active' : '' }}">
            <i class="fas fa-code-branch"></i>
            <span>Route approvals</span>
        </a>
        <a href="{{ route('drivers.panel') }}" class="nav-item {{ request()->routeIs('drivers.panel') ? 'active' : '' }}">
            <i class="fas fa-users"></i>
            <span>Drivers</span>
        </a>
        <a href="{{ route('routes.panel') }}" class="nav-item {{ request()->routeIs('routes.*') ? 'active' : '' }}">
            <i class="fas fa-route"></i>
            <span>Routes</span>
        </a>
        <a href="{{ route('buses.panel') }}" class="nav-item {{ request()->routeIs('buses.*') ? 'active' : '' }}">
            <i class="fas fa-bus-alt"></i>
            <span>Buses</span>
        </a>
        <a href="{{ route('chat.panel') }}" class="nav-item {{ request()->routeIs('chat.*') ? 'active' : '' }}">
            <i class="fas fa-comments"></i>
            <span>Chat</span>
        </a>
        <a href="#" class="nav-item">
            <i class="fas fa-cog"></i>
            <span>Settings</span>
        </a>
    </div>
    <div class="sidebar-footer">
        <a href="#" class="nav-item nav-item--logout d-flex align-items-center gap-2" onclick="event.preventDefault(); document.getElementById('logout-form').submit();">
            <i class="fas fa-sign-out-alt"></i>
            <span>Logout</span>
        </a>
        <form id="logout-form" action="{{ route('logout') }}" method="POST" style="display: none;">
            @csrf
        </form>
    </div>
</div>

<script>
    if (window.history && window.history.pushState) {
        window.history.pushState(null, "", window.location.href);
        window.onpopstate = function () {
            window.location.replace("{{ route('login') }}");
        };
    }
</script>