<?php

namespace App\Http\Controllers;

use App\Models\TerminalSpace;
use App\Models\TerminalOccupancyHistory;
use App\Models\Driver;
use Illuminate\Http\Request;

class TerminalSpaceController extends Controller
{
    // Get all spaces with current driver info
    public function index()
    {
        $spaces = TerminalSpace::with('currentDriver.user', 'currentCompany')->get();
        
        // Get actual drivers for the DRIVER dropdown
        $drivers = Driver::with('user')->where('status', 'active')->get();
        
        // Get operators/companies for reference
        $operators = \DB::table('users')
            ->where('role', 'bus_operator')
            ->where('status', 'active')
            ->select('id', 'name', 'first_name', 'last_name', 'company_name', 'company_contact')
            ->get();
        
        return view('operations.space', compact('spaces', 'drivers', 'operators'));
    }

    // Get all drivers for dropdown (from BusOperator drivers table)
    public function getDrivers()
    {
        // Get drivers with their operators
        $drivers = Driver::with('user')
            ->where('status', 'active')
            ->get()
            ->map(function($driver) {
                return [
                    'id' => $driver->id,
                    'name' => $driver->name,
                    'type' => 'driver',
                    'user' => $driver->user ? [
                        'id' => $driver->user->id,
                        'name' => $driver->user->name,
                        'company_name' => $driver->user->company_name,
                        'company_contact' => $driver->user->company_contact,
                        'email' => $driver->user->email
                    ] : null
                ];
            });

        // Get bus operators
        $operators = \DB::table('users')
            ->where('role', 'bus_operator')
            ->where('status', 'active')
            ->get()
            ->map(function($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'type' => 'operator',
                    'company_name' => $user->company_name,
                    'company_contact' => $user->company_contact,
                    'email' => $user->email
                ];
            });

        return response()->json([
            'drivers' => $drivers->values(),
            'operators' => $operators
        ]);
    }

    // Update space details
    public function updateSpace(Request $request)
    {
        try {
            $request->validate([
                'space_id' => 'required|exists:terminal_spaces,space_id',
                'route_name' => 'nullable|string',
                'accommodation_type' => 'nullable|string|in:Aircon,Non-Aircon',
            ]);

            $space = TerminalSpace::find($request->space_id);
            
            if (!$space) {
                return response()->json(['success' => false, 'message' => 'Space not found'], 404);
            }

            // Update space details
            $updateData = [];
            if ($request->filled('route_name')) {
                $updateData['route_name'] = $request->route_name;
            }
            if ($request->filled('accommodation_type')) {
                $updateData['accommodation_type'] = $request->accommodation_type;
            }

            if (empty($updateData)) {
                return response()->json(['success' => false, 'message' => 'No fields to update'], 400);
            }

            $space->update($updateData);

            // Record in history
            TerminalOccupancyHistory::create([
                'space_id' => $space->space_id,
                'action' => 'edited',
                'route_name' => $request->route_name,
                'accommodation_type' => $request->accommodation_type,
                'time_occupied' => now(),
                'additional_notes' => 'Space details updated'
            ]);

            return response()->json(['success' => true, 'message' => 'Space updated successfully']);
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['success' => false, 'message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Occupy a space
    public function occupy(Request $request)
    {
        try {
            $request->validate([
                'space_id' => 'required|exists:terminal_spaces,space_id',
                'driver_id' => 'required|exists:drivers,id',
                'operator_id' => 'required|exists:users,id',
                'duration_minutes' => 'required|integer|between:1,60',
            ]);

            $space = TerminalSpace::findOrFail($request->space_id);
            $driver = Driver::with('user')->findOrFail($request->driver_id);
            $operator = \DB::table('users')->find($request->operator_id);

            // TEMPORARILY COMMENTED OUT FOR TESTING
            // if (!$driver->user) {
            //     return response()->json(['success' => false, 'message' => 'Driver must be linked to an operator'], 400);
            // }

            $occupiedAt = now();
            $availableAt = $occupiedAt->copy()->addMinutes($request->duration_minutes);

            $space->update([
                'is_occupied' => true,
                'occupied_at' => $occupiedAt,
                'available_at' => $availableAt,
                'current_driver_id' => $driver->id,
                'current_company_id' => $operator->id,  
                'current_duration_minutes' => $request->duration_minutes,
                'status' => 'occupied'
            ]);

            TerminalOccupancyHistory::create([
                'space_id' => $space->space_id,
                'action' => 'occupied',
                'driver_id' => $driver->id,
                'driver_name' => $driver->name,
                'driver_contact' => $driver->contact_number ?? 'N/A',
                'company_id' => $operator->id,
                'company_name' => $operator->company_name ?? 'Unknown Company',
                'company_contact' => $operator->company_contact ?? 'N/A',
                'route_name' => $space->route_name,
                'accommodation_type' => $space->accommodation_type,
                'duration_minutes' => $request->duration_minutes,
                'time_occupied' => $occupiedAt,
                'time_available_again' => $availableAt,
                'additional_notes' => $request->notes ?? null
            ]);

            return response()->json(['success' => true, 'message' => 'Space occupied successfully']);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['success' => false, 'message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (\ModelNotFoundException $e) {
            return response()->json(['success' => false, 'message' => 'Space or driver not found'], 404);
        } catch (\Exception $e) {
            \Log::error('Occupy error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    // Release a space
    public function release(Request $request)
    {
        $request->validate([
            'space_id' => 'required|exists:terminal_spaces,space_id',
            'notes' => 'nullable|string'
        ]);

        $space = TerminalSpace::find($request->space_id);
        
        // Get operator info BEFORE resetting - fetch fresh from DB with error checking
        $operator = null;
        $companyName = 'Unknown Company';
        $companyContact = 'N/A';
        
        if ($space->current_company_id) {
            $operator = \DB::table('users')
                ->where('id', $space->current_company_id)
                ->where('role', 'bus_operator')
                ->first();
                
            if ($operator) {
                $companyName = $operator->company_name ?? 'Unknown Company';
                $companyContact = $operator->company_contact ?? 'N/A';
            }
        }

        // Record release in history with ALL the occupied info
        TerminalOccupancyHistory::create([
            'space_id' => $space->space_id,
            'action' => 'released',
            'driver_id' => $space->current_driver_id,
            'driver_name' => $space->currentDriver?->name,
            'driver_contact' => $space->currentDriver?->contact_number ?? 'N/A',
            'company_id' => $space->current_company_id,
            'company_name' => $companyName,
            'company_contact' => $companyContact,
            'route_name' => $space->route_name,
            'accommodation_type' => $space->accommodation_type,
            'duration_minutes' => $space->current_duration_minutes,
            'time_occupied' => $space->occupied_at,
            'time_released' => now(),
            'additional_notes' => $request->notes ?? 'Manually released'
        ]);

        // NOW reset space to available
        $space->update([
            'is_occupied' => false,
            'occupied_at' => null,
            'available_at' => null,
            'current_driver_id' => null,
            'current_company_id' => null,
            'current_duration_minutes' => null,
            'status' => 'available'
        ]);

        return response()->json(['success' => true, 'message' => 'Space released successfully']);
    }

    // Cancel occupancy
    public function cancel(Request $request)
    {
        try {
            $request->validate([
                'space_id' => 'required|exists:terminal_spaces,space_id',
                'reason' => 'nullable|string'
            ]);

            $space = TerminalSpace::find($request->space_id);

            if (!$space) {
                return response()->json(['success' => false, 'message' => 'Space not found'], 404);
            }

            // Get driver and company info safely
            $driverName = $space->currentDriver?->name ?? 'Unknown';
            $companyName = 'Unknown Company';
            
            if ($space->current_company_id) {
                $operator = \DB::table('users')
                    ->where('id', $space->current_company_id)
                    ->where('role', 'bus_operator')
                    ->first();
                if ($operator) {
                    $companyName = $operator->company_name ?? 'Unknown Company';
                }
            }

            // Record cancellation in history
            TerminalOccupancyHistory::create([
                'space_id' => $space->space_id,
                'action' => 'cancelled',
                'driver_id' => $space->current_driver_id,
                'driver_name' => $driverName,
                'company_id' => $space->current_company_id,
                'company_name' => $companyName,
                'route_name' => $space->route_name,
                'time_occupied' => $space->occupied_at,
                'reason_for_cancellation' => $request->reason ?? 'Cancelled by operator'
            ]);

            // Reset space
            $space->update([
                'is_occupied' => false,
                'occupied_at' => null,
                'available_at' => null,
                'current_driver_id' => null,
                'current_company_id' => null,
                'current_duration_minutes' => null,
                'status' => 'available'
            ]);

            return response()->json(['success' => true, 'message' => 'Occupancy cancelled']);
        } catch (\Exception $e) {
            \Log::error('Cancel error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Add time to an occupied space
    public function addTime(Request $request)
    {
        try {
            $request->validate([
                'space_id' => 'required|exists:terminal_spaces,space_id',
                'additional_minutes' => 'required|integer|between:1,360'
            ]);

            $space = TerminalSpace::findOrFail($request->space_id);

            if (!$space->is_occupied) {
                return response()->json(['success' => false, 'message' => 'Space is not occupied'], 400);
            }

            // Extend the available_at time
            $newAvailableAt = $space->available_at->addMinutes($request->additional_minutes);
            
            $space->update([
                'available_at' => $newAvailableAt,
                'current_duration_minutes' => $space->current_duration_minutes + $request->additional_minutes
            ]);

            // Record in history
            TerminalOccupancyHistory::create([
                'space_id' => $space->space_id,
                'action' => 'occupied',
                'driver_id' => $space->current_driver_id,
                'driver_name' => $space->currentDriver?->name,
                'driver_contact' => $space->currentDriver?->contact_number ?? 'N/A',
                'company_id' => $space->current_company_id,
                'company_name' => $space->currentCompany?->company_name ?? 'Unknown Company',
                'company_contact' => $space->currentCompany?->company_contact ?? 'N/A',
                'route_name' => $space->route_name,
                'accommodation_type' => $space->accommodation_type,
                'duration_minutes' => $request->additional_minutes,
                'time_occupied' => $space->occupied_at,
                'additional_notes' => "Added {$request->additional_minutes} minute(s) to occupancy"
            ]);

            return response()->json(['success' => true, 'message' => "Added {$request->additional_minutes} minutes successfully"]);
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['success' => false, 'message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            \Log::error('Add time error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    public function getSpaces()
    {
        $spaces = TerminalSpace::all();
        return response()->json($spaces);
    }

    // Get history for a specific space
    public function getHistory($spaceId)
    {
        $history = TerminalOccupancyHistory::where('space_id', $spaceId)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json($history);
    }

    // Get all history with filters
    public function getAllHistory(Request $request)
    {
        $query = TerminalOccupancyHistory::query();

        // Determine which date to filter by
        if ($request->filled('date')) {
            $selectedDate = \Carbon\Carbon::createFromFormat('Y-m-d', $request->date)->startOfDay();
        } else {
            $selectedDate = now()->startOfDay();
        }
        
        // Filter by the selected date (entire day)
        $query->whereDate('time_occupied', $selectedDate);

        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        if ($request->filled('space_id')) {
            $query->where('space_id', $request->space_id);
        }

        if ($request->filled('route_name')) {
            $query->where('route_name', 'like', '%' . $request->route_name . '%');
        }

        // PAGINATION: 10 records per page
        $history = $query->orderBy('created_at', 'desc')->paginate(10);

        return response()->json($history);
    }

    public function getHistoryDetail($id)
    {
        $record = TerminalOccupancyHistory::find($id);
        
        if (!$record) {
            return response()->json(['success' => false, 'message' => 'Record not found'], 404);
        }
        
        return response()->json($record);
    }

    public function checkAndReleaseExpiredSpaces()
    {
        try {
            $expiredSpaces = TerminalSpace::where('is_occupied', true)
                ->where('available_at', '<=', now())
                ->get();

            foreach ($expiredSpaces as $space) {
                // Get operator info BEFORE resetting
                $companyName = 'Unknown Company';
                $companyContact = 'N/A';
                
                if ($space->current_company_id) {
                    $operator = \DB::table('users')
                        ->where('id', $space->current_company_id)
                        ->where('role', 'bus_operator')
                        ->first();
                    
                    if ($operator) {
                        $companyName = $operator->company_name ?? 'Unknown Company';
                        $companyContact = $operator->company_contact ?? 'N/A';
                    }
                }

                // Record in history with ALL the occupied info
                TerminalOccupancyHistory::create([
                    'space_id' => $space->space_id,
                    'action' => 'released',
                    'driver_id' => $space->current_driver_id,
                    'driver_name' => $space->currentDriver?->name,
                    'driver_contact' => $space->currentDriver?->contact_number ?? 'N/A',
                    'company_id' => $space->current_company_id,
                    'company_name' => $companyName,
                    'company_contact' => $companyContact,
                    'route_name' => $space->route_name,
                    'accommodation_type' => $space->accommodation_type,
                    'duration_minutes' => $space->current_duration_minutes,
                    'time_occupied' => $space->occupied_at,
                    'time_released' => now(),
                    'additional_notes' => 'Auto-released: duration expired'
                ]);

                // Reset space
                $space->update([
                    'is_occupied' => false,
                    'occupied_at' => null,
                    'available_at' => null,
                    'current_driver_id' => null,
                    'current_company_id' => null,
                    'current_duration_minutes' => null,
                    'status' => 'available'
                ]);
            }

            return response()->json([
                'success' => true, 
                'message' => 'Checked and released ' . count($expiredSpaces) . ' expired spaces',
                'released_count' => count($expiredSpaces),
                'spaces' => $expiredSpaces->pluck('space_id')
            ]);

        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}