<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>TransiTrack - @yield('title')</title>
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link href='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css' rel='stylesheet' />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    @vite(['resources/css/app.css'])
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-directions/v4.1.1/mapbox-gl-directions.js"></script>
    <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-directions/v4.1.1/mapbox-gl-directions.css" type="text/css">
    <script src='https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'></script>
    <style>
        /* Mapbox popup × — larger hit target & contrast (Trip Logs, Routes, etc.) */
        .mapboxgl-popup-close-button {
            width: 2.75rem !important;
            height: 2.75rem !important;
            min-width: 2.75rem !important;
            min-height: 2.75rem !important;
            font-size: 1.65rem !important;
            font-weight: 600 !important;
            line-height: 1 !important;
            padding: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 50% !important;
            background: rgba(255, 255, 255, 0.98) !important;
            color: #212529 !important;
            border: 2px solid rgba(33, 37, 41, 0.4) !important;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2) !important;
            top: 8px !important;
            right: 8px !important;
            z-index: 4 !important;
            opacity: 1 !important;
            transition: background 0.15s ease, color 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
        }
        .mapboxgl-popup-close-button:hover {
            background: #fff !important;
            color: #b02a37 !important;
            border-color: rgba(176, 42, 55, 0.55) !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25) !important;
            transform: scale(1.05);
        }
        .mapboxgl-popup-close-button:focus-visible {
            outline: none !important;
            box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.45), 0 2px 12px rgba(0, 0, 0, 0.2) !important;
        }
    </style>
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
    
    <script>
        mapboxgl.accessToken = 'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA';
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    @vite('resources/js/app.js')
    <script src="{{ asset('js/notifications.js') }}"></script>
    @stack('scripts')
</body>
</html>