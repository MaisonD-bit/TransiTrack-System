<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\User;
use Illuminate\Http\Request;

class BusSchedulesController extends Controller
{
    public function index(Request $request)
    {
        // Update statuses based on current time
        Schedule::updateStatuses();

        // Start query with eager loading
        $query = Schedule::with(['bus', 'driver', 'route']);

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
        
        // Searach functionality
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->whereHas('bus', fn($q) => $q->where('plate_number', 'like', "%$search%"))
                ->orWhereHas('driver', fn($q) => $q->where('name', 'like', "%$search%"))
                ->orWhereHas('route', fn($q) => $q->where('name', 'like', "%$search%"));
            });
        }


        // Paginate results
        $busSchedules = $query->orderBy('date', 'desc')->paginate(10)->withQueryString();

        // For filter dropdown
        $drivers = User::where('role', 'driver')->get(); // Adjust role field as needed
        $statuses = ['scheduled', 'active', 'completed', 'cancelled'];

        return view('operations.schedule-management', compact('busSchedules', 'drivers', 'statuses'));
    }
}
