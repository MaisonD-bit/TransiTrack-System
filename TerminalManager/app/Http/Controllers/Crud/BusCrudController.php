<?php

namespace App\Http\Controllers\Crud;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Bus;
use App\Models\Route;

class BusCrudController extends Controller
{
    public function index()
    {
        $buses = Bus::with('schedules')->get();
        return view('bus.index', compact('buses'));
    }

    public function create()
    {
        $routes = Route::all();
        return view('bus.create', compact('routes'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'plate_number' => 'required|string|max:255',
            'bus_number' => 'nullable|string|max:255',
            'model' => 'required|string|max:255',
            'capacity' => 'required|integer|min:1',
            'bus_company' => 'required|string|max:255',
            'accommodation_type' => 'required|in:air-conditioned,deluxe,super-deluxe',
            'status' => 'required|in:active,inactive,maintenance',
            'description' => 'nullable|string'
        ]);

        Bus::create($validated);

        return redirect()->route('bus.index')->with('success', 'Bus created successfully.');
    }

    public function edit($id)
    {
        $bus = Bus::findOrFail($id);
        $routes = Route::all();
        return view('bus.edit', compact('bus', 'routes'));
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'plate_number' => 'required|string|max:255',
            'bus_number' => 'nullable|string|max:255',
            'model' => 'required|string|max:255',
            'capacity' => 'required|integer|min:1',
            'bus_company' => 'required|string|max:255',
            'accommodation_type' => 'required|in:air-conditioned,deluxe,super-deluxe',
            'status' => 'required|in:active,inactive,maintenance',
            'description' => 'nullable|string'
        ]);

        $bus = Bus::findOrFail($id);
        $bus->update($validated);

        return redirect()->route('bus.index')->with('success', 'Bus updated successfully.');
    }

    public function destroy($id)
    {
        $bus = Bus::findOrFail($id);
        $bus->delete();

        return redirect()->route('bus.index')->with('success', 'Bus deleted successfully.');
    }
}
