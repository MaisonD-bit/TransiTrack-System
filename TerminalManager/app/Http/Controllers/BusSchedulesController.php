<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\Route;
use App\Models\Schedule;
use App\Support\ManagerTerminalScope;
use Illuminate\Http\Request;

class BusSchedulesController extends Controller
{
    use ManagerTerminalScope;

    public function index(Request $request)
    {
        Schedule::updateStatuses();

        $query = Schedule::with(['bus', 'driver', 'route']);
        $this->scopeSchedulesByTerminal($query);

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

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->whereHas('bus', fn ($q) => $q->where('plate_number', 'like', "%$search%"))
                    ->orWhereHas('driver', fn ($q) => $q->where('name', 'like', "%$search%"))
                    ->orWhereHas('route', fn ($q) => $q->where('name', 'like', "%$search%"));
            });
        }

        $query->whereHas('driver', fn ($q) => $q->where('status', 'active'))
            ->whereHas('bus', fn ($q) => $q->whereIn('status', ['available', 'in_service']));

        $busSchedules = $query->orderBy('date', 'desc')->paginate(10)->withQueryString();

        $driverQuery = Driver::query()
            ->where('status', 'active')
            ->select(['id', 'name'])
            ->orderBy('name');

        if ($this->managerTerminal()) {
            $driverQuery->whereHas('user', function ($q) {
                $this->scopeOperatorsByTerminal($q);
            });
        }

        $drivers = $driverQuery->get();

        $routeQuery = Route::where('status', 'active');
        $terminal = $this->managerTerminal();
        if ($terminal) {
            $routeQuery->where('terminal', $terminal);
        }
        $routes = $routeQuery->get();

        $statuses = ['scheduled', 'active', 'completed', 'cancelled', 'accepted', 'pending_decline'];

        return view('operations.bus-schedule', compact('busSchedules', 'drivers', 'routes', 'statuses'));
    }
}
