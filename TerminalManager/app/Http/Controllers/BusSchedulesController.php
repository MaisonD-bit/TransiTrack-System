<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\User;
use App\Models\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BusSchedulesController extends Controller
{
    public function index(Request $request)
    {
        // Update statuses based on current time
        Schedule::updateStatuses();

        // Start query with eager loading
        $query = Schedule::with(['bus', 'driver', 'route']);

        // Filter by terminal for bus managers
        $user = Auth::user();
        if ($user && $user->role === 'northBusManager') {
            $query->whereHas('bus', function ($q) {
                $q->where('terminal', 'north');
            });
        } elseif ($user && $user->role === 'southBusManager') {
            $query->whereHas('bus', function ($q) {
                $q->where('terminal', 'south');
            });
        }

        // Apply filters
        if ($request->filled('date')) {
            $query->whereDate('date', $request->input('date'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('driver_id')) {
            $query->where('driver_id', $request->input('driver_id'));
        }

        if ($request->filled('route_id')) {
            $query->where('route_id', $request->input('route_id'));
        }

        // Searach functionality
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->whereHas('bus', fn($q) => $q->where('plate_number', 'like', "%$search%"))
                    ->orWhereHas('driver', fn($q) => $q->where('name', 'like', "%$search%"))
                    ->orWhereHas('route', fn($q) => $q->where('name', 'like', "%$search%"));
            });
        }

        // Exclude schedules from inactive drivers or bus operators
        $query->whereHas('driver', fn($q) => $q->where('status', 'active'))
            ->whereHas('bus', fn($q) => $q->where('status', 'active'));

        $busSchedules = $query->orderBy('date', 'desc')->paginate(10)->withQueryString();

        // Get drivers and filter by terminal for bus managers
        $driverQuery = User::where('role', 'driver')->select('id', 'first_name', 'last_name', 'terminal');
        if ($user && $user->role === 'northBusManager') {
            $driverQuery->where('terminal', 'north');
        } elseif ($user && $user->role === 'southBusManager') {
            $driverQuery->where('terminal', 'south');
        }
        $drivers = $driverQuery->get();

        // Filter routes by terminal for bus managers
        $routeQuery = Route::where('status', 'active');
        if ($user && $user->role === 'northBusManager') {
            $routeQuery->where('terminal', 'north');
        } elseif ($user && $user->role === 'southBusManager') {
            $routeQuery->where('terminal', 'south');
        }
        $routes = $routeQuery->get();

        $statuses = ['scheduled', 'active', 'completed', 'cancelled'];


        return view('operations.bus-schedule', compact('busSchedules', 'drivers', 'routes', 'statuses'));
    }
}
