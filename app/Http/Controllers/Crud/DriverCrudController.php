<?php

namespace App\Http\Controllers\Crud;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Driver;

class DriverCrudController extends Controller
{
    public function index()
    {
        $drivers = Driver::with('busSchedules')->get();

        return view('drivers.index', compact('drivers'));
    }

    public function create()
    {
        return view('drivers.create');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'license_number' => 'required|string|max:255',
            'contact_info' => 'required|string|max:255',
        ]);

        Driver::create($data);

        return redirect()->route('drivers.index')->with('success', 'Driver created successfully.');
    }

    public function edit($id)
    {
        $drivers = Driver::findOrFail($id);

        return view('drivers.edit', compact('drivers'));
    }

    public function show($id)
    {
        $drivers = Driver::findOrFail($id);
        
        return view('drivers.show', compact('drivers'));
    }

    public function update(Request $request, $id)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'license_number' => 'required|string|max:255',
            'contact_info' => 'nullable|string|max:255',
        ]);

        $drivers = Driver::findOrFail($id);
        $drivers->update($data);

        return redirect()->route('drivers.index')->with('success', 'Driver updated successfully.');
    }

    public function destroy($id)
    {
        $drivers = Driver::findOrFail($id);
        $drivers->delete();

        return redirect()->route('drivers.index')->with('success', 'Driver deleted successfully.');
    }
}
