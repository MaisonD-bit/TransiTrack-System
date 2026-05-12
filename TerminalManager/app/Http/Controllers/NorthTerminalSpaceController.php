<?php

namespace App\Http\Controllers;

use App\Models\NorthTerminalSpace;
use App\Models\NorthTerminalOccupancyHistory;
use App\Models\Driver;
use App\Models\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class NorthTerminalSpaceController extends Controller
{
    // Private method to verify manager terminal authorization for API endpoints
    private function checkTerminalAuthorization()
    {
        $manager = Auth::user();
        if (!$manager || $manager->terminal !== 'north') {
            abort(403, 'Unauthorized access to North Terminal');
        }
    }

    // Get all spaces with current driver info
    public function index()
    {
        // Check if manager is authorized for North Terminal
        $manager = Auth::user();
        if ($manager && $manager->terminal !== 'north') {
            return redirect()->route('spaces.index')->with('message', 'You do not have access to North Terminal. Redirecting to South Terminal.');
        }

        // Get terminal spaces with current driver and company info
        $spaces = NorthTerminalSpace::with('currentDriver.user', 'currentCompany')->get();

        // Get actual drivers for the DRIVER dropdown
        $drivers = Driver::with('user')->where('status', 'active')->get();

        // Get operators/companies for reference
        $operators = DB::table('users')
            ->where('role', 'bus_operator')
            ->where('status', 'active')
            ->select('id', 'name', 'first_name', 'last_name', 'company_name', 'company_contact')
            ->get();

        return view('operations.northspace', compact('spaces', 'drivers', 'operators'));
    }

    // Get all drivers for dropdown (from BusOperator drivers table) - NORTH TERMINAL ONLY
    public function getDrivers()
    {
        // Get drivers assigned to NORTH terminal routes only
        $drivers = Driver::with('user')
            ->whereHas('routes', function ($query) {
                $query->where('terminal', 'north');
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

        // Get bus operators assigned to NORTH terminal
        $operators = DB::table('users')
            ->where('role', 'bus_operator')
            ->where('status', 'active')
            ->where('terminal', 'north')
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
                'space_id' => 'required|exists:north_terminal_spaces,space_id',
                'route_name' => 'nullable|string',
                'accommodation_type' => 'nullable|string|in:Aircon,Non-Aircon',
            ]);

            $space = NorthTerminalSpace::find($request->space_id);

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
            NorthTerminalOccupancyHistory::create([
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

    /**
     * SVG clustering assigns L{n}, T{n}, R{n} before DB rows may exist — create a stub row so occupy works.
     *
     * @return array{position: string, position_order: int, route_name: null, accommodation_type: null, is_occupied: bool, status: string}
     */
    private function inferNorthSpaceDefaults(string $spaceId): array
    {
        $spaceId = strtoupper(trim($spaceId));
        $letter = substr($spaceId, 0, 1);
        $order = (int) substr($spaceId, 1);
        if ($order < 1) {
            $order = 1;
        }
        $position = match ($letter) {
            'L' => 'LEFT',
            'R' => 'RIGHT',
            default => 'TOP',
        };

        return [
            'position' => $position,
            'position_order' => $order,
            'route_name' => null,
            'accommodation_type' => null,
            'is_occupied' => false,
            'status' => 'available',
        ];
    }

    // Occupy a space
    public function occupy(Request $request)
    {
        $this->checkTerminalAuthorization();

        try {
            Log::info('Occupy request received:', $request->all());

            $request->merge([
                'driver_id' => (int) $request->input('driver_id'),
                'operator_id' => (int) $request->input('operator_id'),
                'duration_minutes' => (int) $request->input('duration_minutes'),
            ]);

            $request->validate([
                'space_id' => ['required', 'string', 'max:32', 'regex:/^[LTR]\d+$/i'],
                'driver_id' => 'required|integer|exists:drivers,id',
                'operator_id' => 'required|integer|exists:users,id',
                'duration_minutes' => 'required|integer|between:1,360',
                'route_name' => 'nullable|string',
                'accommodation_type' => 'nullable|string|max:255',
            ]);

            $spaceId = strtoupper(trim((string) $request->space_id));
            $space = NorthTerminalSpace::firstOrCreate(
                ['space_id' => $spaceId],
                $this->inferNorthSpaceDefaults($spaceId)
            );

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

            NorthTerminalOccupancyHistory::create([
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
            'space_id' => 'required|exists:north_terminal_spaces,space_id',
            'notes' => 'nullable|string'
        ]);

        $space = NorthTerminalSpace::find($request->space_id);

        // Find and update the most recent occupied record instead of creating a new one
        $lastOccupancy = NorthTerminalOccupancyHistory::where('space_id', $space->space_id)
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
                'space_id' => 'required|exists:north_terminal_spaces,space_id',
                'reason' => 'nullable|string'
            ]);

            $space = NorthTerminalSpace::find($request->space_id);

            if (!$space) {
                return response()->json(['success' => false, 'message' => 'Space not found'], 404);
            }

            // Find and update the most recent occupied record instead of creating a new one
            $lastOccupancy = NorthTerminalOccupancyHistory::where('space_id', $space->space_id)
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
                'space_id' => 'required|exists:north_terminal_spaces,space_id',
                'additional_minutes' => 'required|integer|between:1,360'
            ]);

            $space = NorthTerminalSpace::findOrFail($request->space_id);
            Log::info('Space found:', ['space_id' => $space->space_id, 'is_occupied' => $space->is_occupied]);

            if (!$space->is_occupied) {
                Log::warning('Space is not occupied', ['space_id' => $space->space_id]);
                return response()->json(['success' => false, 'message' => 'Space is not occupied'], 400);
            }

            $additionalTime = $request->additional_minutes;
            $newAvailableAt = $space->available_at->addMinutes($additionalTime);
            $totalDuration = $space->current_duration_minutes + $additionalTime;

            $space->update([
                'available_at' => $newAvailableAt,
                'current_duration_minutes' => $totalDuration,
            ]);

            return response()->json([
                'success' => true,
                'message' => "Added $additionalTime minutes successfully",
                'new_expiration_time' => $newAvailableAt->toIso8601String(),
                'total_duration' => $totalDuration
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['success' => false, 'message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (ModelNotFoundException $e) {
            return response()->json(['success' => false, 'message' => 'Space not found'], 404);
        } catch (\Exception $e) {
            Log::error('addTime error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    // Get history for a specific space
    public function getHistory($spaceId)
    {
        $history = NorthTerminalOccupancyHistory::where('space_id', $spaceId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['success' => true, 'data' => $history]);
    }

    // Get all history with pagination
    public function getAllHistory(Request $request)
    {
        $this->checkTerminalAuthorization();

        $query = NorthTerminalOccupancyHistory::query();

        // Apply filters
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('space_id', 'like', "%$search%")
                    ->orWhere('driver_name', 'like', "%$search%")
                    ->orWhere('company_name', 'like', "%$search%")
                    ->orWhere('route_name', 'like', "%$search%");
            });
        }

        if ($request->filled('space_filter')) {
            $query->where('space_id', $request->space_filter);
        }

        if ($request->filled('driver_filter')) {
            $query->where('driver_name', 'like', "%{$request->driver_filter}%");
        }

        if ($request->filled('company_filter')) {
            $query->where('company_name', 'like', "%{$request->company_filter}%");
        }

        if ($request->filled('date_from')) {
            $query->whereDate('time_occupied', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('time_occupied', '<=', $request->date_to);
        }

        if ($request->filled('action_filter')) {
            $query->where('action', $request->action_filter);
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
                'Content-Disposition' => 'attachment; filename="north_terminal_history_' . now()->format('Y-m-d_H-i-s') . '.csv"',
            ]);
        }

        $history = $query->orderBy('created_at', 'desc')->paginate(10);

        return response()->json(['success' => true, 'data' => $history]);
    }

    // Get spaces - for JS to fetch
    public function getSpaces()
    {
        $spaces = NorthTerminalSpace::all();
        return response()->json($spaces);
    }

    public function getHistoryDetail($id)
    {
        $history = NorthTerminalOccupancyHistory::find($id);

        if (!$history) {
            return response()->json(['success' => false, 'message' => 'History record not found'], 404);
        }

        return response()->json(['success' => true, 'data' => $history]);
    }

    // Check and release expired spaces
    public function checkAndReleaseExpiredSpaces()
    {
        try {
            $expiredSpaces = NorthTerminalSpace::where('is_occupied', true)
                ->whereNotNull('available_at')
                ->where('available_at', '<=', now())
                ->get();

            foreach ($expiredSpaces as $space) {
                // Find the last occupancy record
                $lastOccupancy = NorthTerminalOccupancyHistory::where('space_id', $space->space_id)
                    ->where('action', 'occupied')
                    ->orderBy('created_at', 'desc')
                    ->first();

                if ($lastOccupancy) {
                    $lastOccupancy->update([
                        'action' => 'released',
                        'time_released' => now(),
                        'additional_notes' => ($lastOccupancy->additional_notes ?? '') . ' | Auto-released (time expired)'
                    ]);
                }

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
                'message' => 'Expired spaces released',
                'released_count' => $expiredSpaces->count()
            ]);
        } catch (\Exception $e) {
            Log::error('checkAndReleaseExpiredSpaces error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getRoutes()
    {
        $routes = Route::all();
        return response()->json($routes);
    }

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
}
