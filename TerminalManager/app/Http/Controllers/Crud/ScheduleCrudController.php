<?php

namespace App\Http\Controllers\Crud;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Bus;
use App\Models\User;
use App\Models\Route;
use App\Models\Schedule;

class ScheduleCrudController extends Controller
{
    public function index()
    {
        $schedules = Schedule::with(['bus', 'driver', 'route'])->get();

        return view('schedules.index', compact('schedules'));
    }

    public function create()
    {
        $buses = Bus::all();
        $drivers = User::where('role', 'driver')->get(); // or adjust to your role system
        $routes = Route::all();

        return view('schedules.create', compact('buses', 'drivers', 'routes'));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'bus_id' => 'required|exists:buses,id',
            'driver_id' => 'required|exists:users,id',
            'route_id' => 'required|exists:routes,id',
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'status' => 'required|in:scheduled,active,completed,cancelled',
            'days' => 'nullable|array',
            'notes' => 'nullable|string',
            'actual_stops' => 'nullable|array',
        ]);

        Schedule::create($data);

        return redirect()->route('schedules.index')->with('success', 'Schedule created successfully.');
    }

    public function edit($id)
    {
        $schedules = Schedule::findOrFail($id);
        $buses = Bus::all();
        $drivers = User::where('role', 'driver')->get();
        $routes = Route::all();

        return view('schedules.edit', compact('schedule', 'buses', 'drivers', 'routes'));
    }

    public function update(Request $request, $id)
    {
        $data = $request->validate([
            'bus_id' => 'required|exists:buses,id',
            'driver_id' => 'required|exists:users,id',
            'route_id' => 'required|exists:routes,id',
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'status' => 'required|in:scheduled,active,completed,cancelled',
            'days' => 'nullable|array',
            'notes' => 'nullable|string',
            'actual_stops' => 'nullable|array',
        ]);

        $schedules = Schedule::findOrFail($id);
        $schedules->update($data);

        return redirect()->route('schedules.index')->with('success', 'Schedule updated successfully.');
    }

    public function destroy($id)
    {
        $schedules = Schedule::findOrFail($id);
        $schedules->delete();

        return redirect()->route('schedules.index')->with('success', 'Schedule deleted successfully.');
    }
}
