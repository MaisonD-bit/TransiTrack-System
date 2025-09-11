<?php

namespace App\Http\Controllers\Crud;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Route;

class RouteCrudController extends Controller
{
    public function index()
    {
        $routes = Route::all();

        return view('routes.index', compact('routes'));
    }

    public function create()
    {
        return view('routes.create');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:routes,code',
            'start_location' => 'required|string|max:255',
            'end_location' => 'required|string|max:255',
            'description' => 'nullable|string',
            'regular_price' => 'required|numeric|min:0',
            'aircon_price' => 'nullable|numeric|min:0',
            'distance_km' => 'required|numeric|min:0',
            'estimated_duration' => 'required|integer|min:1',
            'status' => 'required|in:active,inactive',
        ]);

        Route::create($data);

        return redirect()->route('routes.index')->with('success', 'Route created successfully.');
    }

    public function edit($id)
    {
        $routes = Route::findOrFail($id);

        return view('routes.edit', compact('route'));
    }


    public function update(Request $request, $id)
    {
        $routes = Route::findOrFail($id);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:routes,code,' . $routes->id,
            'start_location' => 'required|string|max:255',
            'end_location' => 'required|string|max:255',
            'description' => 'nullable|string',
            'regular_price' => 'required|numeric|min:0',
            'aircon_price' => 'nullable|numeric|min:0',
            'distance_km' => 'required|numeric|min:0',
            'estimated_duration' => 'required|integer|min:1',
            'status' => 'required|in:active,inactive',
        ]);

        $routes->update($data);

        return redirect()->route('routes.index')->with('success', 'Route updated successfully.');
    }

    public function destroy($id)
    {
        $routes = Route::findOrFail($id);
        $routes->delete();

        return redirect()->route('routes.index')->with('success', 'Route deleted successfully.');
    }
}
