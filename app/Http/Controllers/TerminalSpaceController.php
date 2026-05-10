<?php

namespace App\Http\Controllers;

use App\Models\TerminalSpace;
use App\Models\TerminalOccupancyHistory;
use App\Models\Driver;
use App\Models\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class TerminalSpaceController extends Controller
{
    // Private method to verify manager terminal authorization for API endpoints
    private function checkTerminalAuthorization()
    {
        $manager = Auth::user();
        if (!$manager || $manager->terminal !== 'south') {
            abort(403, 'Unauthorized access to South Terminal');
        }
    }
    
    // Get all spaces with current driver info
    public function index()
    {
        // Check if manager is authorized for South Terminal
        $manager = Auth::user();
        if ($manager && $manager->terminal !== 'south') {
            return redirect()->route('north-spaces.index')->with('message', 'You do not have access to South Terminal. Redirecting to North Terminal.');
        }

        // Get terminal spaces with current driver and company info
        $spaces = TerminalSpace::with('currentDriver.user', 'currentCompany')->get();

        // Get actual drivers for the DRIVER dropdown
        $drivers = Driver::with('user')->where('status', 'active')->get();

        // Get operators/companies for reference
        $operators = DB::table('users')
            ->where('role', 'bus_operator')
            ->where('status', 'active')
            ->select('id', 'name', 'first_name', 'last_name', 'company_name', 'company_contact')
            ->get();

        return view('operations.space', compact('spaces', 'drivers', 'operators'));
    }

    // Get all drivers for dropdown (from BusOperator drivers table) - SOUTH TERMINAL ONLY
    public function getDrivers()
    {
        // Get drivers assigned to SOUTH terminal routes only
        $drivers = Driver::with('user')
            ->whereHas('routes', function ($query) {
                $query->where('terminal', 'south');
            })
            ->where('status', 'active')
            ->get()
            ->map(function ($driver) {
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

        // Get bus operators assigned to SOUTH terminal
        $operators = DB::table('users')
            ->where('role', 'bus_operator')
            ->where('status', 'active')
            ->where('terminal', 'south')
            ->get()
            ->map(function ($user) {
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
        $this->checkTerminalAuthorization();

        try {
            Log::info('Occupy request received:', $request->all());

            $request->validate([
                'space_id' => 'required|exists:terminal_spaces,space_id',
                'driver_id' => 'required|exists:drivers,id',
                'operator_id' => 'required|exists:users,id',
                'duration_minutes' => 'required|integer|between:1,360',
                'route_name' => 'nullable|string',
                'accommodation_type' => 'nullable|string'
            ]);

            $space = TerminalSpace::findOrFail($request->space_id);
            $driver = Driver::with('user')->findOrFail($request->driver_id);
            $operator = DB::table('users')->find($request->operator_id);

            $occupiedAt = now();
            $availableAt = $occupiedAt->copy()->addMinutes($request->duration_minutes);

            $space->update([
                'is_occupied' => true,
                'occupied_at' => $occupiedAt,
                'available_at' => $availableAt,
                'current_driver_id' => $driver->id,
                'current_company_id' => $operator->id,
                'current_duration_minutes' => $request->duration_minutes,
                'route_name' => $request->route_name,
                'accommodation_type' => $request->accommodation_type,
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
                'route_name' => $request->route_name ?? $space->route_name,
                'accommodation_type' => $request->accommodation_type ?? $space->accommodation_type,
                'duration_minutes' => $request->duration_minutes,
                'time_occupied' => $occupiedAt,
                'time_available_again' => $availableAt,
                'additional_notes' => $request->notes ?? null
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Space occupied successfully',
                'expiration_time' => $availableAt->toIso8601String()
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['success' => false, 'message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (ModelNotFoundException $e) {
            return response()->json(['success' => false, 'message' => 'Space or driver not found'], 404);
        } catch (\Exception $e) {
            Log::error('Occupy error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    // Release a space
    public function release(Request $request)
    {
        $this->checkTerminalAuthorization();

        $request->validate([
            'space_id' => 'required|exists:terminal_spaces,space_id',
            'notes' => 'nullable|string'
        ]);

        $space = TerminalSpace::find($request->space_id);

        // Find and update the most recent occupied record instead of creating a new one
        $lastOccupancy = TerminalOccupancyHistory::where('space_id', $space->space_id)
            ->where('action', 'occupied')
            ->orderBy('created_at', 'desc')
            ->first();

        if ($lastOccupancy) {
            // Update the existing occupied record with release info
            $lastOccupancy->update([
                'action' => 'released',
                'time_released' => now(),
                'additional_notes' => $lastOccupancy->additional_notes ? $lastOccupancy->additional_notes . ' | ' . ($request->notes ?? 'Released') : ($request->notes ?? 'Released')
            ]);
        }

        // Reset space to available
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
        $this->checkTerminalAuthorization();

        try {
            $request->validate([
                'space_id' => 'required|exists:terminal_spaces,space_id',
                'reason' => 'nullable|string'
            ]);

            $space = TerminalSpace::find($request->space_id);

            if (!$space) {
                return response()->json(['success' => false, 'message' => 'Space not found'], 404);
            }

            // Find and update the most recent occupied record instead of creating a new one
            $lastOccupancy = TerminalOccupancyHistory::where('space_id', $space->space_id)
                ->where('action', 'occupied')
                ->orderBy('created_at', 'desc')
                ->first();

            if ($lastOccupancy) {
                // Update the existing occupied record with cancellation info
                $lastOccupancy->update([
                    'action' => 'cancelled',
                    'time_released' => now(),
                    'reason_for_cancellation' => $request->reason ?? 'Cancelled by operator',
                    'additional_notes' => $lastOccupancy->additional_notes ? $lastOccupancy->additional_notes . ' | CANCELLED: ' . ($request->reason ?? 'No reason provided') : 'CANCELLED: ' . ($request->reason ?? 'No reason provided')
                ]);
            }

            // Reset space to available
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
            Log::error('Cancel error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Add time to an occupied space
    public function addTime(Request $request)
    {
        try {
            Log::info('addTime called with:', $request->all());

            $request->validate([
                'space_id' => 'required|exists:terminal_spaces,space_id',
                'additional_minutes' => 'required|integer|between:1,360'
            ]);

            $space = TerminalSpace::findOrFail($request->space_id);
            Log::info('Space found:', ['space_id' => $space->space_id, 'is_occupied' => $space->is_occupied]);

            if (!$space->is_occupied) {
                Log::warning('Space is not occupied', ['space_id' => $space->space_id]);
                return response()->json(['success' => false, 'message' => 'Space is not occupied'], 400);
            }

            // Extend the available_at time
            $newAvailableAt = $space->available_at->addMinutes($request->additional_minutes);

            $space->update([
                'available_at' => $newAvailableAt,
                'current_duration_minutes' => $space->current_duration_minutes + $request->additional_minutes
            ]);

            // Update the most recent history record for this space to show additional time was added
            $lastHistory = TerminalOccupancyHistory::where('space_id', $space->space_id)
                ->where('action', 'occupied')
                ->orderBy('created_at', 'desc')
                ->first();

            Log::info('Last history found:', ['has_record' => $lastHistory ? true : false]);

            if ($lastHistory) {
                // Append additional time to the notes
                $currentNotes = $lastHistory->additional_notes ?? '';
                $addedNote = "Added +{$request->additional_minutes} min at " . now()->format('H:i:s');
                $newNotes = $currentNotes ? $currentNotes . " | " . $addedNote : $addedNote;

                $lastHistory->update([
                    'duration_minutes' => $space->current_duration_minutes,
                    'additional_notes' => $newNotes
                ]);

                Log::info('Updated history notes:', ['new_notes' => $newNotes, 'new_total_duration' => $space->current_duration_minutes]);
            }

            return response()->json([
                'success' => true,
                'message' => "Added {$request->additional_minutes} minutes successfully",
                'expiration_time' => $newAvailableAt->toIso8601String()
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Validation failed:', $e->errors());
            return response()->json(['success' => false, 'message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Add time error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    public function getSpaces()
    {
        $spaces = TerminalSpace::all();
        return response()->json($spaces);
    }

    // Get all active routes
    public function getRoutes()
    {
        $routes = DB::table('routes')
            ->where('status', 'active')
            ->orderBy('name')
            ->pluck('name')
            ->unique()
            ->values();

        return response()->json($routes);
    }

    // Get driver's assigned routes
    public function getDriverRoutes($driverId)
    {
        try {
            $routes = Route::whereHas('schedules', function ($query) use ($driverId) {
                $query->where('driver_id', $driverId);
            })
                ->where('status', 'active')
                ->select('id', 'name', 'bus_type')
                ->orderBy('name')
                ->get();

            return response()->json(['success' => true, 'routes' => $routes]);
        } catch (\Exception $e) {
            Log::error('Get driver routes error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Get history for a specific space
    public function getHistory($spaceId)
    {
        $this->checkTerminalAuthorization();

        $history = TerminalOccupancyHistory::where('space_id', $spaceId)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json($history);
    }

    // Get all history with filters
    public function getAllHistory(Request $request)
    {
        $this->checkTerminalAuthorization();

        $query = TerminalOccupancyHistory::query();

        // Handle date range filtering
        if ($request->filled('date_from') && $request->filled('date_to')) {
            $dateFrom = \Carbon\Carbon::createFromFormat('Y-m-d', $request->date_from)->startOfDay();
            $dateTo = \Carbon\Carbon::createFromFormat('Y-m-d', $request->date_to)->endOfDay();
            $query->whereBetween('time_occupied', [$dateFrom, $dateTo]);
        } elseif ($request->filled('date_from')) {
            $dateFrom = \Carbon\Carbon::createFromFormat('Y-m-d', $request->date_from)->startOfDay();
            $query->whereDate('time_occupied', '>=', $dateFrom);
        } elseif ($request->filled('date_to')) {
            $dateTo = \Carbon\Carbon::createFromFormat('Y-m-d', $request->date_to)->endOfDay();
            $query->whereDate('time_occupied', '<=', $dateTo);
        } else {
            // Default to today if no date range specified
            $selectedDate = now()->startOfDay();
            $query->whereDate('time_occupied', $selectedDate);
        }

        // Filter by action/status
        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        // Filter by space_id
        if ($request->filled('space_id')) {
            $query->where('space_id', $request->space_id);
        }

        // Filter by driver_id
        if ($request->filled('driver_id')) {
            $query->where('driver_id', $request->driver_id);
        }

        // Filter by route_name
        if ($request->filled('route_name')) {
            $query->where('route_name', $request->route_name);
        }

        // Handle search filter
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('space_id', 'LIKE', "%{$search}%")
                    ->orWhere('route_name', 'LIKE', "%{$search}%")
                    ->orWhere('driver_name', 'LIKE', "%{$search}%");
            });
        }

        // Check if CSV export is requested
        if ($request->filled('export') && $request->export === 'csv') {
            $records = $query->orderBy('created_at', 'desc')->get();

            // Generate CSV
            $headers = [
                'Space ID',
                'Route',
                'Driver',
                'Action',
                'Time Occupied',
                'Time Released',
                'Duration (mins)',
                'Company',
                'Notes'
            ];

            $csv = fopen('php://memory', 'w');
            fputcsv($csv, $headers);

            foreach ($records as $record) {
                fputcsv($csv, [
                    $record->space_id,
                    $record->route_name ?? 'N/A',
                    $record->driver_name ?? 'N/A',
                    ucfirst($record->action),
                    $record->time_occupied ? $record->time_occupied->format('Y-m-d H:i:s') : 'N/A',
                    $record->time_released ? $record->time_released->format('Y-m-d H:i:s') : 'N/A',
                    $record->duration_minutes ?? 'N/A',
                    $record->company_name ?? 'N/A',
                    $record->additional_notes ?? ''
                ]);
            }

            rewind($csv);
            $content = stream_get_contents($csv);
            fclose($csv);

            return response($content, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="terminal_history_' . now()->format('Y-m-d_H-i-s') . '.csv"',
            ]);
        }

        // PAGINATION: 10 records per page (for JSON response)
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
                    $operator = DB::table('users')
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
