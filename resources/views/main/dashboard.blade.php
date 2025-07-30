@extends('layouts.app')

@section('content')
<style>
    .dashboard-card {
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        background: #fff;
        padding: 1.5rem 1rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
        min-width: 220px;
        text-align: center;
    }

    .dashboard-icon {
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-size: 2rem;
        flex-shrink: 0;
        margin-bottom: 0.5rem;
    }

    .icon-blue { background: #e3f0fc; color: #2b7be4; }
    .icon-green { background: #eafaf1; color: #1bb76e; }
    .icon-yellow { background: #fffbe5; color: #e6b800; }
    .icon-purple { background: #f3eafd; color: #a259e6; }
    .dashboard-label {
        font-size: 1rem;
        color: #444;
        margin-bottom: 0.2rem;
    }

    .dashboard-value {
        font-size: 1.5rem;
        font-weight: bold;
        letter-spacing: 1px;
    }
    
</style>

<div class="container py-4">
    <h1 class="mb-4 fw-bold" style="font-size:2rem;">Dashboard Overview</h1>

    <div class="row g-3 justify-content-center">
        <!-- Active Buses -->
        <div class="col-12 col-sm-6 col-md-3">
            <div class="dashboard-card">
                <div class="dashboard-icon icon-blue">
                    <i class="bi bi-bus-front"></i>
                </div>
                <div>
                    <div class="dashboard-label">Active Buses</div>
                    <div class="dashboard-value">{{ $stats['active_busses'] }}</div>
                </div>
            </div>
        </div>

        <!-- Available Spaces -->
        <div class="col-12 col-sm-6 col-md-3">
            <div class="dashboard-card">
                <div class="dashboard-icon icon-green">
                    <i class="bi bi-p-circle-fill"></i>
                </div>
                <div>
                    <div class="dashboard-label">Available Spaces</div>
                    <div class="dashboard-value">{{ $stats['available_spaces'] }} / {{ $stats['total_spaces'] }}</div>
                </div>
            </div>
        </div>

        <!-- Active Alerts -->
        <div class="col-12 col-sm-6 col-md-3">
            <div class="dashboard-card">
                <div class="dashboard-icon icon-yellow">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                </div>
                <div>
                    <div class="dashboard-label">Active Alerts</div>
                    <div class="dashboard-value">{{ $stats['active_alerts'] }}</div>
                </div>
            </div>
        </div>

        <!-- New Messages -->
        <div class="col-12 col-sm-6 col-md-3">
            <div class="dashboard-card">
                <div class="dashboard-icon icon-purple">
                    <i class="bi bi-envelope-fill"></i>
                </div>
                <div>
                    <div class="dashboard-label">New Messages</div>
                    <div class="dashboard-value">{{ $stats['new_messages'] }}</div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
