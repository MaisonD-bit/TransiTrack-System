<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Terminal Manangement Dashboard</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        body {
            background: #222;
        }

        .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            width: 280px;
            background: #1a1c30;
            /* background: #2052d9; */
            color: #fff;
            padding: 0;
            z-index: 100;
            display: flex;
            flex-direction: column;
        }

        .sidebar-header {
            padding: 1.5rem 1.2rem 1rem 1.2rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .sidebar-header .bi {
            font-size: 2rem;
            margin-right: 0.5rem;
        }

        .sidebar-title {
            font-size: 1.3rem;
            font-weight: bold;
            vertical-align: middle;
        }

        .sidebar-section {
            margin-top: 1.5rem;
        }

        .sidebar-section-title {
            font-size: 0.85rem;
            color: #b3c6ff;
            margin-bottom: 0.5rem;
            letter-spacing: 1px;
            font-weight: 600;
            margin-left: 20px;
        }

        .sidebar-link {
            display: flex;
            align-items: center;
            gap: 0.7rem;
            color: #fff;
            text-decoration: none;
            font-size: 1rem;
            padding: 0.45rem 0;
            padding-left: 1.2rem;
            transition: background 0.15s;
        }

        .sidebar-link:hover,
        .sidebar-link.active {
            background: rgba(255, 255, 255, 0.1);
            border-left: 4px solid #4e6ef2;
            color: white;
        }

        .sidebar-link .bi {
            font-size: 1.3rem;
        }

        .sidebar-footer {
            margin-top: auto;
            padding: 1rem 1.2rem;
            color: #b3c6ff;
            font-size: 0.95rem;
        }

        .logoutBtn {
            background: transparent;
            border: none;
            font-size: 1rem;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            text-decoration: none;
        }

        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            margin-left: 260px;
            min-height: 100vh;
            background: #ffffffdb;
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
        }

        .content-wrapper {
            padding-left: 2rem;
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
        <div class="sidebar-header d-flex align-items-center">
            <i class="bi bi-bus-front"></i>
            <span class="sidebar-title">TransiTrack</span>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-section-title">MAIN</div>
            <a href="{{ route('dashboard') }}" class="sidebar-link {{ request()->routeIs('dashboard') ? 'active' : '' }}">
                <i class="bi bi-speedometer2"></i>
                Dashboard
            </a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-section-title">TERMINAL OPERATIONS</div>
            <a href="{{ route('schedule-management') }}" class="sidebar-link {{ request()->routeIs('schedule-management') ? 'active' : '' }}">
                <i class="fas fa-calendar-alt"></i>
                Bus Schedules
            </a>

            <a href="{{ route('rental-management') }}" class="sidebar-link {{ request()->routeIs('rental-management') ? 'active' : '' }}">
                <i class="bi bi-clipboard"></i>
                Rental Applications
            </a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-section-title">COMMUNICATION</div>

            <a href="{{ route('message-management') }}" class="sidebar-link {{ request()->routeIs('message-management') ? 'active' : '' }}">
                <i class="bi bi-chat-dots-fill"></i>
                Messages & Announcements
            </a>
        </div>

        <div class="sidebar-section">
            <div class="sidebar-section-title">CRUD</div>

            <a href="{{ route('spaces.index') }}" class="sidebar-link">
                <i class="bi bi-pen"></i>
                Add Spaces
            </a>

            <a href="{{ route('routes.index') }}" class="sidebar-link">
                <i class="bi bi-pen"></i>
                Add Routes
            </a>

            <a href="{{ route('bus.index') }}" class="sidebar-link">
                <i class="bi bi-pen"></i>
                Add Busses
            </a>

            <a href="{{ route('schedules.index') }}" class="sidebar-link">
                <i class="bi bi-pen"></i>
                Add Schedules
            </a>
        </div>



        <div class="sidebar-footer">
            <form action="{{ route('logout') }}" method="POST">
                @csrf
                <button type="submit" class="logoutBtn">
                    <i class="fa-solid fa-right-from-bracket me-2 text-danger">  Logout</i> 
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