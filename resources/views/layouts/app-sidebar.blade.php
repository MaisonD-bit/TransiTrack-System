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
            width: 280px;
            background: linear-gradient(to bottom, var(--primary), #1a1c30);
            padding: 20px 0;
            box-shadow: 3px 0 10px rgba(0, 0, 0, 0.1);
            color: white;
            z-index: 100;
            display: flex;
            flex-direction: column;
        }

        .sidebar-section {
            margin-top: 1.5rem;
        }

        .sidebar-link {
            display: flex;
            align-items: center;
            gap: 1rem;
            color: white;
            text-decoration: none;
            padding: 15px 20px;
            padding-left: 1.2rem;
            border-left: 4px solid transparent;
            transition: all 0.3s;
        }

        .sidebar-link:hover,
        .sidebar-link.active {
            background: rgba(255, 255, 255, 0.1);
            border-left: 4px solid var(--secondary);
            color: white;
        }

        .sidebar-link .bi {
            font-size: 1.3rem;
        }

        .logoutBtn {
            background: transparent;
            border: none;
            font-size: 1rem;
            color: white;
            cursor: pointer;
            align-items: center;
            text-decoration: none;
            width: 100%;
        }

        .logoutBtn:hover {
            color: var(--accent);
        }

        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            margin-left: 260px;
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
        }

        .sidebar-link span {
            font-size: 16px;
        }

        .logo {
            display: flex;
            align-items: center;
            padding: 0 20px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
                position: relative;
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
                <span>Messages & Announcements</span>
            </a>

            <a href="{{ route('chat') }}" class="sidebar-link {{ request()->routeIs('chat.*') ? 'active' : '' }}">
                <i class="bi bi-chat-left-text-fill"></i>
                <span>Chat</span>
            </a>

            @if(Auth::check() && Auth::user()->terminal === 'south')
            <a href="{{ route('spaces.index') }}" class="sidebar-link {{ request()->routeIs('spaces.*') ? 'active' : '' }}">
                <i class="fas fa-map-marker-alt"></i>
                <span>South Terminal Spaces</span>
            </a>
            @endif

            @if(Auth::check() && Auth::user()->terminal === 'north')
            <a href="{{ route('north-spaces.index') }}" class="sidebar-link {{ request()->routeIs('north-spaces.*') ? 'active' : '' }}">
                <i class="fas fa-map-marker-alt"></i>
                <span>North Terminal Spaces</span>
            </a>
            @endif

            <a href="{{ route('approval') }}" class="sidebar-link {{ request()->routeIs('approval') ? 'active' : '' }}">
                <i class="fas fa-check-circle"></i>
                <span>Operator Approvals</span>
            </a>

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

</body>

</html>