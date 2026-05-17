<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>TransiTrack Sysadmin — @yield('title')</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    @vite(['resources/css/app.css'])
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <div class="container-fluid p-0">
        <div class="d-flex flex-row min-vh-100">
            @include('layouts.sidebar')
            <div class="main-content flex-grow-1">
                @include('layouts.topbar')
                @yield('content')
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="{{ asset('js/sysadmin-feedback.js') }}"></script>
    <script src="{{ asset('js/sysadmin-ui.js') }}"></script>
    @vite('resources/js/app.js')
    @stack('scripts')
</body>
</html>
