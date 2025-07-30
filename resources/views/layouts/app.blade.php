<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Terminal Manangement Dashboard</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <style>
        body {
            background: #222;
        }

        .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            width: 260px;
            background: #2052d9;
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
            padding-left: 1.2rem;
            padding-right: 1.2rem;
        }

        .sidebar-section-title {
            font-size: 0.85rem;
            color: #b3c6ff;
            margin-bottom: 0.5rem;
            letter-spacing: 1px;
            font-weight: 600;
        }

        .sidebar-link {
            display: flex;
            align-items: center;
            gap: 0.7rem;
            color: #fff;
            text-decoration: none;
            font-size: 1rem;
            padding: 0.45rem 0;
            border-radius: 6px;
            transition: background 0.15s;
        }

        .sidebar-link:hover,
        .sidebar-link.active {
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
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
            margin-left: 260px;
            min-height: 100vh;
            background: #f5f7fa;
            padding-left: 24px;
            padding-top: 0;
            padding-right: 0;
            padding-bottom: 0;
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
            <a href="{{ route('dashboard') }}" class="sidebar-link">
                <i class="bi bi-speedometer2"></i>
                Dashboard
            </a>
        </div>
        <div class="sidebar-section">
            <div class="sidebar-section-title">OPERATIONS</div>
            <a href="{{ route('schedule-management') }}" class="sidebar-link">
                <i class="bi bi-calendar-event"></i>
                Bus Schedules
            </a>
            <a href="#" class="sidebar-link">
                <i class="bi bi-speedometer2"></i>
                Terminal Operations
            </a>
            <a href="#" class="sidebar-link">
                <i class="bi bi-clipboard"></i>
                Terminal Rental Management
            </a>
        </div>
        <div class="sidebar-section">
            <div class="sidebar-section-title">COMMUNICATION</div>
            <a href="#" class="sidebar-link">
                <i class="bi bi-chat-dots-fill"></i>
                Messages & Announcements
            </a>
        </div>
        <div class="sidebar-footer">
            <button type="submit" class="logoutBtn"><i class="bi bi-box-arrow-right"> Logout</i></button>
        </div>
    </div>
    <div class="main-content">
        @yield('content')
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>

</html>