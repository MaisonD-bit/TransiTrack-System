<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Terminal Manangement - @yield('title')</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    @stack('styles')
    <style>
        body {
            background: #222;
        }

        :root {
            --primary: #1a1c30;
            --secondary: #3498db;
            --accent: #e74c3c;
            --light: #ecf0f1;
            --dark: #1a1c30;
            --success: #2ecc71;
            --warning: #f39c12;
        }

        .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            max-height: 100vh;
            width: 280px;
            background: linear-gradient(to bottom, var(--primary), #1a1c30);
            padding: 20px 0 0;
            box-shadow: 3px 0 10px rgba(0, 0, 0, 0.1);
            color: white;
            z-index: 100;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .sidebar-section {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
            padding-top: 1rem;
            gap: 0;
            scrollbar-width: none;
            -ms-overflow-style: none;
        }

        .sidebar-section::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
        }

        .sidebar-footer {
            flex-shrink: 0;
            padding: 1rem 0 1.25rem;
            margin-top: 0.75rem;
            border-top: 1px solid rgba(255, 255, 255, 0.12);
            background: linear-gradient(to bottom, var(--primary), #1a1c30);
        }

        .sidebar-footer form {
            margin: 0;
        }

        .sidebar-link {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            color: white;
            text-decoration: none;
            padding: 15px 20px;
            padding-left: calc(1.2rem - 2px);
            border-left: 4px solid transparent;
            transition: background 0.3s, border-color 0.3s;
        }

        .sidebar-link:hover,
        .sidebar-link.active {
            background: rgba(255, 255, 255, 0.1);
            border-left: 4px solid var(--secondary);
            color: white;
        }

        .sidebar-link .bi {
            font-size: 1.25rem;
        }

        .logoutBtn {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            background: transparent;
            border: none;
            font-size: 16px;
            font-weight: 500;
            color: white;
            cursor: pointer;
            text-decoration: none;
            width: 100%;
            padding: 15px 20px;
            padding-left: calc(1.2rem - 2px);
            border-left: 4px solid transparent;
            transition: background 0.3s, border-color 0.3s, color 0.3s;
        }

        .logoutBtn:hover {
            color: var(--accent);
        }

        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            margin-left: 280px;
            min-height: 100vh;
            background-color: #fff;
            padding: 20px;
            padding-left: 40px;
        }

        .topbar {
            background: white;
            padding: 20px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            z-index: 10;
            height: 74.19px;
        }
        
        h4 {
            font-weight: 600;
            color: black;
        }

        .user-info {
            display: flex;
            align-items: center;
        }

        .user-info img {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 10px;
            object-fit: cover;
        }

        .user-details {
            margin-right: 20px;
            text-align: right;
        }

        .user-details h4 {
            font-size: 16px;
            font-weight: 600;
        }

        .user-details p {
            font-size: 13px;
            color: #7f8c8d;
        }

        .notification {
            position: relative;
            margin-right: 20px;
            font-size: 20px;
            color: var(--dark);
            cursor: pointer;
        }

        .notification .badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: var(--accent);
            color: white;
            font-size: 10px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .sidebar-link i {
            font-size: 20px;
            width: 24px;
            text-align: center;
            flex-shrink: 0;
        }

        .sidebar-link span {
            font-size: 16px;
            font-weight: 500;
            line-height: 1.3;
            text-align: left;
        }

        .logo {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            padding: 0 20px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            background: linear-gradient(to bottom, var(--primary), #1a1c30);
        }

        .logo i {
            font-size: 28px;
            margin-right: 10px;
            color: #fff;
        }

        .logo h1 {
            font-size: 22px;
            font-weight: 600;
        }

        .content-wrapper {
            padding-left: 2rem;
        }

        .logo-img {
            width: 40px;
            height: 40px;
            margin-right: 10px;
            object-fit: contain;
        }

        @media (max-width: 768px) {
            .sidebar {
                width: 100vw;
                height: auto;
                max-height: none;
                position: relative;
                overflow: visible;
            }

            .sidebar-section {
                flex: none;
                overflow: visible;
            }

            .sidebar-footer {
                flex: none;
            }

            .sidebar-link {
                flex: none;
                padding: 12px 20px;
            }

            .logoutBtn {
                flex: none;
                padding: 12px 20px;
            }

            .main-content {
                margin-left: 0;
            }
        }
    </style>
</head>

<body>
    <div class="sidebar">
        <div class="logo">
            <img src="{{ asset('images/transitrack_logo.png') }}" alt="TransiTrack Logo" class="logo-img">
            <h1>TransiTrack</h1>
        </div>

        <div class="sidebar-section">
            <a href="{{ route('dashboard') }}" class="sidebar-link {{ request()->routeIs('dashboard') ? 'active' : '' }}">
                <i class="fas fa-tachometer-alt"></i>
                <span>Manager Dashboard</span>
            </a>

            <a href="{{ route('bus-schedule') }}" class="sidebar-link {{ request()->routeIs('bus-schedule') ? 'active' : '' }}">
                <i class="fas fa-calendar-alt"></i>
                <span>Bus Schedules</span>
            </a>

            <a href="{{ route('messages') }}" class="sidebar-link {{ request()->routeIs('message') ? 'active' : '' }}">
                <i class="bi bi-chat-dots-fill"></i>
                <span>Announcements</span>
            </a>

            <a href="{{ route('chat') }}" class="sidebar-link {{ request()->routeIs('chat.*') ? 'active' : '' }}">
                <i class="bi bi-chat-left-text-fill"></i>
                <span>Chat</span>
            </a>

            <a href="{{ route('spaces.index') }}" class="sidebar-link {{ request()->routeIs('spaces.*') ? 'active' : '' }}">
                <i class="fas fa-map-marker-alt"></i>
                <span>Spaces</span>
            </a>

            <a href="{{ route('terminal.route-stops') }}" class="sidebar-link {{ request()->routeIs('terminal.route-stops*') ? 'active' : '' }}">
                <i class="fas fa-route"></i>
                <span>Route stops</span>
            </a>
        </div>

        <div class="sidebar-footer">
            <form action="{{ route('logout') }}" method="POST">
                @csrf
                <button type="submit" class="sidebar-link logoutBtn">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Logout</span>
                </button>
            </form>
        </div>
    </div>

    <div class="main-content flex-grow-1">
        @include('layouts.topbar')
        <div class="content-wrapper">
            @yield('content')
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    @stack('scripts')

</body>

</html>