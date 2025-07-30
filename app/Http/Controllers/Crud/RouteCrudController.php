<?php

namespace App\Http\Controllers\Crud;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Route;

class RouteCrudController extends Controller
{
    public function index()
    {
        $routes = Route::with('busSchedules')->get();

        return view('crud.routes.index', compact('routes'));
    }

    public function create()
    {
        return view('route.create');
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'start_location' => 'required|string|max:255',
            'end_location' => 'required|string|max:255',
            'distance' => 'required|numeric|min:0',
            'duration' => 'required|integer|min:1',
        ]);

        Route::create($request->all());

        return redirect()->route('routes.index')->with('success', 'Route created successfully.');
    }

    public function edit($id)
    {
        $route = Route::findOrFail($id);

        return view('route.edit', compact('route'));
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'start_location' => 'required|string|max:255',
            'end_location' => 'required|string|max:255',
            'distance' => 'required|numeric|min:0',
            'duration' => 'required|integer|min:1',
        ]);

        $route = Route::findOrFail($id);
        $route->update($request->all());

        return redirect()->route('routes.index')->with('success', 'Route updated successfully.');
    }

    public function destroy($id)
    {
        $route = Route::findOrFail($id);
        $route->delete();

        return redirect()->route('routes.index')->with('success', 'Route deleted successfully.');
    }
}
