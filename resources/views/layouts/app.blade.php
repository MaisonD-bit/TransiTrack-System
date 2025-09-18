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
            background: #ffffffff;
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

        .dashboard-card {
            border: 2px solid #6610f2;
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
            font-weight: 500;
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

        .logoutBtn:hover {
            background-color: white;
            color: var(--dark);
            border-radius: 20px;
            padding: 5px 10px;
            transition: all 0.3s;
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
            <i class="fas fa-bus"></i>
            <h1>TransiTrack</h1>
        </div>

        <div class="sidebar-section">
            <a href="{{ route('dashboard') }}" class="sidebar-link {{ request()->routeIs('dashboard') ? 'active' : '' }}">
                <i class="fas fa-tachometer-alt"></i>
                <span>Manager Panel</span>
            </a>

            <a href="{{ route('schedule-management') }}" class="sidebar-link {{ request()->routeIs('schedule-management') ? 'active' : '' }}">
                <i class="fas fa-calendar-alt"></i>
                <span>Bus Schedules</span>
            </a>

            <a href="{{ route('message-management') }}" class="sidebar-link {{ request()->routeIs('message-management') ? 'active' : '' }}">
                <i class="bi bi-chat-dots-fill"></i>
                <span>Messages & Announcements</span>
            </a>

            <a href="#" class="sidebar-link">
                <i class="fas fa-cog"></i>
                <span>Settings</span>
            </a>

            <a href="#" class="sidebar-link">
                <i class="fas fa-cog"></i>
                <span>Profile</span>
            </a>
        </div>

        <div class="sidebar-footer">
            <form action="{{ route('logout') }}" method="POST">
                @csrf
                <button type="submit" class="logoutBtn">
                    <i class="fa-solid fa-right-from-bracket me-2 text-danger"> Logout</i>
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