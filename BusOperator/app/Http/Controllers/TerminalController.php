<?php

namespace App\Http\Controllers;

use App\Models\Bus;
use App\Models\Route;
use App\Models\Schedule;
use App\Models\User;
use App\Models\Terminal;
use App\Models\Driver;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class TerminalController extends Controller
{
    /**
     * Display the terminal management panel
     */
    public function index()
    {
        try {
            // Get active routes
            $routes = Route::where('status', 'active')
                ->orWhere('status', null)
                ->get();
            
            // Get active drivers with license number
            $drivers = Driver::where('status', 'active')
                ->orWhere('status', null)
                ->select('id', 'name', 'email', 'license_number')
                ->orderBy('name')
                ->get();
            
            // Get active buses
            $buses = Bus::where('status', 'active')
                ->orWhere('status', null)
                ->get();

            return view('panels.terminal', compact('routes', 'drivers', 'buses'));
        } catch (\Exception $e) {
            Log::error('Terminal index error: ' . $e->getMessage());
            return redirect()->back()->with('error', 'Error loading terminal: ' . $e->getMessage());
        }
    }

    /**
     * Get terminal spaces and their availability
     */
    public function getSpaces(Request $request)
    {
        try {
            $date = $request->input('date', Carbon::today()->format('Y-m-d'));
            
            // Define all terminal spaces
            $allSpaces = [
                'L1', 'L2', 'L3', 'L4', 'L5', 'L6',
                'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12',
                'R1', 'R2', 'R3', 'R4', 'R5', 'R6'
            ];
            
            // Get all schedules for the date with terminal spaces
            $schedules = Schedule::with(['route', 'driver', 'bus'])
                ->where('date', $date)
                ->whereNotNull('terminal_space')
                ->get()
                ->groupBy('terminal_space');
            
            // Build terminal spaces data
            $terminalSpaces = [];
            foreach ($allSpaces as $spaceId) {
                $spaceType = $this->getSpaceType($spaceId);
                $spaceName = $this->getSpaceName($spaceId);
                $spaceSchedules = $schedules->get($spaceId, collect());
                
                $terminalSpaces[] = [
                    'id' => $spaceId,
                    'name' => $spaceName,
                    'type' => $spaceType,
                    'schedules' => $spaceSchedules->toArray()
                ];
            }
            
            return response()->json($terminalSpaces);
            
        } catch (\Exception $e) {
            Log::error('Terminal getSpaces error: ' . $e->getMessage());
            return response()->json([
                'error' => 'Server error occurred',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Book a terminal space
     */
    public function bookSpace(Request $request)
    {
        try {
            Log::info('Terminal booking request received', $request->all());
            
            // Ensure we have test data
            $this->ensureTestData();
            
            $terminalSpace = $request->input('terminal_space') ?? $request->input('space_id');
            $spaceType = $this->getSpaceType($terminalSpace);
            
            Log::info("Space type: {$spaceType} for terminal space: {$terminalSpace}");
            
            // Basic validation
            $request->validate([
                'space_id' => 'required|string',
                'date' => 'required|date',
                'start_time' => 'required',
                'end_time' => 'required',
                'bus_id' => 'required|exists:buses,id',
                'customer_name' => 'required|string|max:255',
                'contact_number' => 'required|string|max:20',
            ]);

            // Additional validation for boarding gates
            if ($spaceType === 'loading') {
                $request->validate([
                    'route_id' => 'required|exists:routes,id',
                    'driver_id' => 'required|exists:users,id',
                ]);
            }
            
            // Check for conflicts
            $conflictingSchedule = Schedule::where('terminal_space', $terminalSpace)
                ->where('date', $request->date)
                ->where(function($query) use ($request) {
                    $query->where('start_time', '<', $request->end_time)
                          ->where('end_time', '>', $request->start_time);
                })
                ->first();
            
            if ($conflictingSchedule) {
                return response()->json([
                    'success' => false,
                    'message' => 'This time slot conflicts with an existing reservation'
                ], 400);
            }
            
            // Get defaults for required fields
            $defaultRoute = Route::first();
            $defaultDriver = User::where('role', 'driver')->first();
            
            if (!$defaultRoute || !$defaultDriver) {
                Log::error('Missing default route or driver');
                return response()->json([
                    'success' => false,
                    'message' => 'System configuration error: Missing default route or driver'
                ], 500);
            }
            
            // Build schedule data
            $scheduleData = [
                'date' => $request->date,
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
                'bus_id' => $request->bus_id,
                'status' => 'scheduled',
                'terminal_space' => $terminalSpace,
                'customer_name' => $request->customer_name,
                'contact_number' => $request->contact_number,
                'notes' => $request->notes
            ];
            
            // Handle route and driver based on space type
            if ($spaceType === 'loading') {
                // Boarding gates - use provided route and driver
                $scheduleData['route_id'] = $request->route_id;
                $scheduleData['driver_id'] = $request->driver_id;
                $scheduleData['passengers'] = $request->passengers;
            } else {
                // Parking spaces - use defaults since no route is needed
                $scheduleData['route_id'] = $defaultRoute->id;
                $scheduleData['driver_id'] = $request->driver_id ?: $defaultDriver->id;
                $scheduleData['passengers'] = null;
            }
            
            Log::info('Creating schedule with data:', $scheduleData);
            
            // Create the schedule
            $schedule = Schedule::create($scheduleData);
            
            Log::info('Schedule created successfully with ID: ' . $schedule->id);
            
            return response()->json([
                'success' => true,
                'message' => ($spaceType === 'parking' ? 'Parking space' : 'Boarding gate') . ' reserved successfully!',
                'schedule' => $schedule->load(['route', 'driver', 'bus'])
            ]);
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Validation error:', $e->errors());
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Terminal booking error: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Release a terminal space
     */
    public function releaseSpace($id)
    {
        try {
            $schedule = Schedule::findOrFail($id);
            $schedule->update([
                'status' => 'cancelled',
                'terminal_space' => null
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'Terminal space released successfully!'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Terminal releaseSpace error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error releasing space: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Ensure test data exists
     */
    private function ensureTestData()
    {
        // Create test bus if none exist
        if (Bus::count() === 0) {
            Bus::create([
                'plate_number' => 'TEST-001',
                'capacity' => 40,
                'status' => 'active'
            ]);
        }
        
        // Create test route if none exist
        if (Route::count() === 0) {
            Route::create([
                'code' => 'PARKING',
                'start_location' => 'Terminal',
                'end_location' => 'Terminal',
                'status' => 'active',
                'estimated_duration' => 0
            ]);
        }
        
        // Create test driver if none exist
        if (User::where('role', 'driver')->count() === 0) {
            User::create([
                'name' => 'Test Driver',
                'email' => 'driver@test.com',
                'password' => bcrypt('password'),
                'role' => 'driver',
                'status' => 'active'
            ]);
        }
    }

    /**
     * Get space type based on space ID
     */
    private function getSpaceType($spaceId)
    {
        if (strpos($spaceId, 'L') === 0 || strpos($spaceId, 'R') === 0) {
            return 'loading';
        }
        return 'parking';
    }

    /**
     * Get space name based on space ID
     */
    private function getSpaceName($spaceId)
    {
        if (strpos($spaceId, 'L') === 0) {
            return 'Left Boarding Gate ' . substr($spaceId, 1);
        } elseif (strpos($spaceId, 'R') === 0) {
            return 'Right Boarding Gate ' . substr($spaceId, 1);
        } elseif (strpos($spaceId, 'P') === 0) {
            return 'Parking Space ' . substr($spaceId, 1);
        }
        return $spaceId;
    }

    /**
     * Check terminal availability
     */
    public function checkAvailability(Request $request)
    {
        try {
            $request->validate([
                'date' => 'required|date',
                'start_time' => 'required',
                'end_time' => 'required',
            ]);
            
            $occupiedSpaces = Schedule::where('date', $request->date)
                ->whereNotNull('terminal_space')
                ->where(function($query) use ($request) {
                    $query->where('start_time', '<', $request->end_time)
                          ->where('end_time', '>', $request->start_time);
                })
                ->pluck('terminal_space')
                ->toArray();
            
            return response()->json(['occupied_spaces' => $occupiedSpaces]);
            
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Server error occurred',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get terminal statistics
     */
    public function getStats(Request $request)
    {
        try {
            $date = $request->input('date', Carbon::today()->format('Y-m-d'));
            $totalSpaces = 24;
            
            $occupiedSpaces = Schedule::where('date', $date)
                ->whereNotNull('terminal_space')
                ->count();
            
            $revenue = Schedule::where('date', $date)
                ->whereNotNull('terminal_space')
                ->get()
                ->sum(function($schedule) {
                    $start = Carbon::parse($schedule->start_time);
                    $end = Carbon::parse($schedule->end_time);
                    $hours = $end->diffInHours($start);
                    $rate = (strpos($schedule->terminal_space, 'L') === 0 || strpos($schedule->terminal_space, 'R') === 0) ? 100 : 30;
                    return $hours * $rate;
                });
            
            return response()->json([
                'total_spaces' => $totalSpaces,
                'occupied_spaces' => $occupiedSpaces,
                'available_spaces' => $totalSpaces - $occupiedSpaces,
                'occupancy_rate' => round(($occupiedSpaces / $totalSpaces) * 100, 1),
                'daily_revenue' => $revenue
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Server error occurred',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function assignSpace(Request $request)
    {
        $validated = $request->validate([
            'space_id' => 'required|string',
            'route_id' => 'required|exists:routes,id',
            'driver_id' => 'required|exists:drivers,id',
            'bus_id' => 'required|exists:buses,id'
        ]);

        try {
            // Store assignment (you may need to create a TerminalAssignment model)
            $assignment = Terminal::create([
                'space_id' => $validated['space_id'],
                'route_id' => $validated['route_id'],
                'driver_id' => $validated['driver_id'],
                'bus_id' => $validated['bus_id'],
                'assigned_date' => now()->format('Y-m-d'),
                'status' => 'active'
            ]);

            return response()->json(['success' => true, 'message' => 'Space assigned successfully']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function getAssignments(Request $request)
    {
        $date = $request->query('date', now()->format('Y-m-d'));
        
        $assignments = Terminal::with(['route', 'driver', 'bus'])
            ->whereDate('assigned_date', $date)
            ->where('status', 'active')
            ->get();

        return response()->json(['assignments' => $assignments]);
    }

    public function removeAssignment(Request $request)
    {
        $assignment = Terminal::find($request->assignment_id);
        
        if ($assignment) {
            $assignment->update(['status' => 'inactive']);
            return response()->json(['success' => true]);
        }

        return response()->json(['success' => false], 404);
    }
}