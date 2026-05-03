<?php

namespace App\Http\Controllers\Crud;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Space;

class SpaceCrudController extends Controller
{
    public function index()
    {
        $spaces = Space::with('busSchedules')->get();
        return view('operations.space', compact('spaces'));
    }

    public function create()
    {
        return view('spaces.create');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'location'    => 'required|string|max:255',
            'is_occupied' => 'sometimes|boolean',
        ]);

        $data['is_occupied'] = $request->boolean('is_occupied');

        Space::create($data);

        return redirect()->route('spaces.index')->with('success', 'Space created successfully.');
    }

    public function edit($id)
    {
        $spaces = Space::findOrFail($id);

        return view('spaces.edit', compact('spaces'));
    }

    public function show($id)
    {
        $spaces = Space::findOrFail($id);

        return view('spaces.show', compact('spaces'));
    }

   public function update(Request $request, $id)
    {
        $data = $request->validate([
            'location'    => 'required|string|max:255',
            'is_occupied' => 'sometimes|boolean',
        ]);

        $data['is_occupied'] = $request->boolean('is_occupied');

        $space = Space::findOrFail($id);
        $space->update($data);

        return redirect()->route('spaces.index')->with('success', 'Space updated successfully.');
    }

    public function destroy($id)
    {
        $spaces = Space::findOrFail($id);
        $spaces->delete();

        return redirect()->route('spaces.index')->with('success', 'Space deleted successfully.');
    }
}
