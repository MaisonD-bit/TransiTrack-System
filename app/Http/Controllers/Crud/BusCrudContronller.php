<?php

namespace App\Http\Controllers\Crud;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Bus;

class BusCrudContronller extends Controller
{
    public function index()
    {
        $buses = Bus::with(['driver', 'space'])->get();

        return view('bus.index', compact('buses'));
    }

    public function create()
    {
        return view('bus.create');
    }

    public function store(Request $request)
    {
        $request->validate([
            'plate_number' => 'required|string|max:255',
            'company' => 'required|string|max:255',
            'type' => 'required|string|max:255',
            'status' => 'required|in:active,inactive,maintenance',
            'rental_status' => 'required|in:active,inactive',
            'capacity' => 'required|integer|min:1',
        ]);

        Bus::create($request->all());

        return redirect()->route('bus.index')->with('success', 'Bus created successfully.');
    }

    public function edit($id)
    {
        $bus = Bus::findOrFail($id);

        return view('bus.edit', compact('bus'));
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'plate_number' => 'required|string|max:255',
            'company' => 'required|string|max:255',
            'type' => 'required|string|max:255',
            'status' => 'required|in:active,inactive,maintenance',
            'rental_status' => 'required|in:active,inactive',
            'capacity' => 'required|integer|min:1',
        ]);

        $bus = Bus::findOrFail($id);
        $bus->update($request->all());

        return redirect()->route('bus.index')->with('success', 'Bus updated successfully.');
    }

    public function destroy($id)
    {
        $bus = Bus::findOrFail($id);
        $bus->delete();

        return redirect()->route('bus.index')->with('success', 'Bus deleted successfully.');
    }
}
