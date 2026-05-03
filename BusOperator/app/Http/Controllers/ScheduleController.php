<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\Driver;
use App\Models\Route;
use App\Models\RouteApprovalRequest;
use App\Models\Bus;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;

class ScheduleController extends Controller
{
    public function schedulePanel()
    {
        try {
            $userId = auth()->id();
            Log::info("Current user ID: " . $userId);

            // Only routes that completed approval (terminal stops + sysadmin)
            $approvedRouteIds = $this->approvedRouteIdsForOperator((int) $userId);
            $routes = Route::where('user_id', $userId)
                ->whereIn('id', $approvedRouteIds)
                ->get();
            $buses = Bus::where('user_id', $userId)->get();
            $drivers = Driver::where('user_id', auth()->id())->get();

            // Start query builder for schedules
            $query = Schedule::with(['route', 'bus', 'driver'])->where('user_id', $userId);

            // Apply filters if present
            if (request()->filled('driver')) {
                $query->where('driver_id', request('driver'));
            }
            if (request()->filled('route')) {
                $query->where('route_id', request('route'));
            }
            if (request()->filled('date')) {
                $query->whereDate('date', request('date'));
            }
            if (request()->filled('status')) {
                $query->where('status', request('status'));
            }

            $schedules = $query->orderBy('updated_at', 'desc')
                ->orderBy('created_at', 'desc')
                ->orderBy('date', 'desc')
                ->paginate(10);

            return view('panels.schedule', compact('routes', 'buses', 'drivers', 'schedules'));

        } catch (\Exception $e) {
            Log::error("Error loading schedule panel: " . $e->getMessage());
            return view('panels.schedule', [
                'routes' => collect(),
                'buses' => collect(),
                'drivers' => collect(),
                'schedules' => collect(),
                'error' => 'Error loading schedule data'
            ]);
        }
    }

    /**
     * Lightweight checksum so the schedule panel can poll for driver status changes (accept/decline/active/etc.).
     */
    public function schedulePanelChecksum(Request $request): JsonResponse
    {
        $userId = auth()->id();
        if (! $userId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $query = Schedule::query()->where('user_id', $userId);

        if ($request->filled('driver')) {
            $query->where('driver_id', $request->driver);
        }
        if ($request->filled('route')) {
            $query->where('route_id', $request->route);
        }
        if ($request->filled('date')) {
            $query->whereDate('date', $request->date);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $count = (clone $query)->count();
        $maxUpdated = (clone $query)->max('updated_at');
        $stamp = $maxUpdated ? (string) $maxUpdated : '';

        return response()->json([
            'success' => true,
            'checksum' => md5($stamp.'|'.$count),
            'count' => $count,
        ]);
    }

    /**
     * Store a new schedule (WEB)
     */
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'driver_id' => 'required|exists:drivers,id',
                'route_id' => 'required|exists:routes,id',
                'bus_id' => 'required|exists:buses,id',
                'date' => 'required|date_format:Y-m-d|after_or_equal:today',
                'start_time' => 'required|date_format:H:i',
                'end_time' => 'required|date_format:H:i|after:start_time',
                'status' => 'required|in:scheduled,active,completed,cancelled',
            ], [
                'date.after_or_equal' => 'The schedule date must be today or a future date.',
                'end_time.after' => 'End time must be after start time.',
            ]);

            $this->assertScheduleStartNotInPast($validated['date'], $validated['start_time']);

            // Check for overlapping schedules
            $overlappingSchedule = $this->checkForOverlappingSchedules(
                $validated['driver_id'],
                $validated['date'],
                $validated['start_time'],
                $validated['end_time']
            );

            if ($overlappingSchedule) {
                if ($request->expectsJson()) {
                    return response()->json([
                        'success' => false,
                        'message' => "Cannot create schedule: Driver already has a schedule from {$overlappingSchedule->start_time} to {$overlappingSchedule->end_time} on {$overlappingSchedule->date}."
                    ], 422);
                }
                return redirect()->back()->with('error', "Cannot create schedule: Driver already has a schedule from {$overlappingSchedule->start_time} to {$overlappingSchedule->end_time} on {$overlappingSchedule->date}.")->withInput();
            }

            $this->ensureRouteApprovedForOperator((int) $validated['route_id'], (int) auth()->id());

            // Get route details for fare calculation
            $route = Route::find($validated['route_id']);
            $bus = Bus::find($validated['bus_id']);

            // Calculate fare based on route fare if available, otherwise use regular/aircon prices
            $fare_regular = 0;
            $fare_aircon = 0;

            // Prioritize route_fare if it exists
            if ($route->route_fare) {
                $fare_regular = $route->route_fare;
                $fare_aircon = $route->route_fare;
            } else {
                // Fallback to regular and aircon prices
                $fare_regular = $route->regular_price ?? 0;
                $fare_aircon = $route->aircon_price ?? $fare_regular;
            }

            // If bus is air-con, use aircon fare
            if ($bus && $bus->accommodation_type === 'air-conditioned') {
                $fare_aircon = $route->route_fare ? $route->route_fare : ($route->aircon_price ?? $fare_regular);
            }

            $schedule = Schedule::create([
                'user_id' => auth()->id(), // ✅ Add user_id
                'driver_id' => $validated['driver_id'],
                'route_id' => $validated['route_id'],
                'bus_id' => $validated['bus_id'],
                'date' => $validated['date'],
                'start_time' => $validated['start_time'],
                'end_time' => $validated['end_time'],
                'status' => 'scheduled',
                'fare_regular' => $fare_regular,
                'fare_aircon' => $fare_aircon,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Schedule created successfully',
                    'schedule' => $schedule->load(['driver', 'route', 'bus'])
                ], 201);
            }
            return redirect()->route('schedule.panel')->with('success', 'Schedule created successfully');
        } catch (\Illuminate\Validation\ValidationException $e) {
            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $e->errors()
                ], 422);
            }
            return redirect()->back()->withErrors($e->errors())->withInput();
        } catch (\Exception $e) {
            Log::error("Error creating schedule: " . $e->getMessage());
            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error creating schedule: ' . $e->getMessage()
                ], 500);
            }
            return redirect()->back()->with('error', 'Error creating schedule')->withInput();
        }
    }
    
    /**
     * Display a specific schedule (WEB)
     */
    public function show($id)
    {
        try {
            $userId = auth()->id();
            $schedule = Schedule::with(['driver', 'route', 'bus'])
                ->where('user_id', $userId)
                ->findOrFail($id);
            return response()->json($schedule);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Schedule not found'], 404);
        }
    }
    
    /**
     * Update a schedule (WEB)
     */
    public function update(Request $request, $id)
    {
        try {
            $schedule = Schedule::where('user_id', auth()->id())->findOrFail($id);
            $validated = $request->validate([
                'driver_id' => 'required|exists:drivers,id',
                'route_id' => 'required|exists:routes,id',
                'bus_id' => 'required|exists:buses,id',
                'date' => 'required|date_format:Y-m-d',
                'start_time' => 'required|date_format:H:i',
                'end_time' => 'required|date_format:H:i|after:start_time',
                'status' => 'required|in:scheduled,active,completed,cancelled,accepted,declined',
            ], [
                'end_time.after' => 'End time must be after start time.',
            ]);

            $todayStr = Carbon::today()->format('Y-m-d');
            $oldYmd = $schedule->date instanceof \Carbon\CarbonInterface
                ? $schedule->date->format('Y-m-d')
                : Carbon::parse((string) $schedule->date)->format('Y-m-d');

            if ($validated['date'] < $todayStr && $validated['date'] !== $oldYmd) {
                throw ValidationException::withMessages([
                    'date' => ['You cannot change this schedule to a past date.'],
                ]);
            }

            if ($validated['date'] >= $todayStr) {
                $this->assertScheduleStartNotInPast($validated['date'], $validated['start_time']);
            }

            // Check for overlapping schedules (exclude current schedule)
            $overlappingSchedule = $this->checkForOverlappingSchedules(
                $validated['driver_id'],
                $validated['date'],
                $validated['start_time'],
                $validated['end_time'],
                $schedule->id
            );

            if ($overlappingSchedule) {
                if ($request->expectsJson()) {
                    return response()->json([
                        'success' => false,
                        'message' => "Cannot update schedule: Driver already has a schedule from {$overlappingSchedule->start_time} to {$overlappingSchedule->end_time} on {$overlappingSchedule->date}."
                    ], 422);
                }
                return redirect()->back()->with('error', "Cannot update schedule: Driver already has a schedule from {$overlappingSchedule->start_time} to {$overlappingSchedule->end_time} on {$overlappingSchedule->date}.")->withInput();
            }

            $this->ensureRouteApprovedForOperator((int) $validated['route_id'], (int) auth()->id());

            // Get route details for fare calculation
            $route = Route::find($validated['route_id']);
            $bus = Bus::find($validated['bus_id']);

            // Calculate fare based on route fare if available, otherwise use regular/aircon prices
            $fare_regular = 0;
            $fare_aircon = 0;

            // Prioritize route_fare if it exists
            if ($route->route_fare) {
                $fare_regular = $route->route_fare;
                $fare_aircon = $route->route_fare;
            } else {
                // Fallback to regular and aircon prices
                $fare_regular = $route->regular_price ?? 0;
                $fare_aircon = $route->aircon_price ?? $fare_regular;
            }

            // If bus is air-con, use aircon fare
            if ($bus && $bus->accommodation_type === 'air-conditioned') {
                $fare_aircon = $route->route_fare ? $route->route_fare : ($route->aircon_price ?? $fare_regular);
            }

            // Touch updated_at to ensure it appears at top
            $validated['updated_at'] = now();
            
            $validated['fare_regular'] = $fare_regular;
            $validated['fare_aircon'] = $fare_aircon;

            $schedule->update($validated);

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Schedule updated successfully',
                    'schedule' => $schedule->load(['driver', 'route', 'bus'])
                ]);
            }
            return redirect()->route('schedule.panel')->with('success', 'Schedule updated successfully');
        } catch (\Exception $e) {
            Log::error("Error updating schedule: " . $e->getMessage());
            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error updating schedule: ' . $e->getMessage()
                ], 500);
            }
            return redirect()->back()->with('error', 'Error updating schedule');
        }
    }
    
    /**
     * Delete a schedule (WEB)
     */
    public function destroy($id)
    {
        try {
            $schedule = Schedule::findOrFail($id);
            $schedule->delete();
            
            return response()->json([
                'success' => true,
                'message' => 'Schedule deleted successfully'
            ]);
            
        } catch (\Exception $e) {
            Log::error("Error deleting schedule: " . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error deleting schedule: ' . $e->getMessage()
            ], 500);
        }
    }

    public function storeBulk(Request $request)
    {
        $schedulesInput = $request->input('schedules', []);
        $attributeNames = $this->bulkScheduleAttributeNames($schedulesInput);

        $validator = Validator::make($request->all(), [
            'schedules' => 'required|array|min:1',
            'schedules.*.driver_id' => 'required|exists:drivers,id',
            'schedules.*.route_id' => 'required|exists:routes,id',
            'schedules.*.bus_id' => 'required|exists:buses,id',
            'schedules.*.date' => 'required|date_format:Y-m-d|after_or_equal:today',
            'schedules.*.start_time' => 'required|date_format:H:i',
            'schedules.*.end_time' => 'required|date_format:H:i',
        ], [
            'schedules.required' => 'Add at least one schedule.',
            'schedules.min' => 'Add at least one schedule.',
            'schedules.*.date.after_or_equal' => ':attribute cannot be before today.',
            'schedules.*.driver_id.required' => ':attribute is required.',
            'schedules.*.route_id.required' => ':attribute is required.',
            'schedules.*.bus_id.required' => ':attribute is required.',
            'schedules.*.date.required' => ':attribute is required.',
            'schedules.*.start_time.required' => ':attribute is required.',
            'schedules.*.end_time.required' => ':attribute is required.',
        ], $attributeNames);

        $validator->after(function ($validator) use ($request) {
            foreach ($request->input('schedules', []) as $i => $row) {
                $date = $row['date'] ?? null;
                $start = $row['start_time'] ?? null;
                $end = $row['end_time'] ?? null;
                $n = (int) $i + 1;

                if ($date && $start && $end) {
                    try {
                        $startAt = Carbon::parse(trim($date).' '.trim($start));
                        $endAt = Carbon::parse(trim($date).' '.trim($end));
                        if ($endAt->lte($startAt)) {
                            $validator->errors()->add(
                                "schedules.{$i}.end_time",
                                "Schedule {$n}: end time must be after start time."
                            );
                        }
                    } catch (\Throwable $e) {
                        // ignore parse errors; other rules catch bad input
                    }
                }

                if ($date && $start) {
                    try {
                        $startAt = Carbon::parse(trim($date).' '.trim($start));
                        if ($startAt->lt(now())) {
                            $validator->errors()->add(
                                "schedules.{$i}.start_time",
                                "Schedule {$n}: start time cannot be in the past (must be after ".$this->formatNowForMessage().').'
                            );
                        }
                    } catch (\Throwable $e) {
                    }
                }
            }
        });

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $schedulesData = $request->schedules;

        if ($overlapMsg = $this->bulkDriverSchedulesOverlapInBatch($schedulesData)) {
            return response()->json([
                'success' => false,
                'message' => $overlapMsg,
            ], 422);
        }
        $createdSchedules = [];
        DB::beginTransaction();
        try {
            foreach ($schedulesData as $scheduleData) {
                $route = Route::find($scheduleData['route_id']);
                $bus = Bus::find($scheduleData['bus_id']);
                if (!$route || !$bus) {
                    throw new \Exception('Invalid route or bus ID.');
                }
                if ((int) $route->user_id !== (int) auth()->id()) {
                    throw new \Exception('Invalid route for your account.');
                }
                $this->ensureRouteApprovedForOperator((int) $route->id, (int) auth()->id());
                
                // Calculate fare based on route fare if available, otherwise use regular/aircon prices
                $fare_regular = 0;
                $fare_aircon = 0;
                
                // Prioritize route_fare if it exists
                if ($route->route_fare) {
                    $fare_regular = $route->route_fare;
                    $fare_aircon = $route->route_fare;
                } else {
                    // Fallback to regular and aircon prices
                    $fare_regular = $route->regular_price ?? 0;
                    $fare_aircon = $route->aircon_price ?? $fare_regular;
                }
                
                // If bus is air-con, use aircon fare
                if ($bus && $bus->accommodation_type === 'air-conditioned') {
                    $fare_aircon = $route->route_fare ? $route->route_fare : ($route->aircon_price ?? $fare_regular);
                }
                
                // Check for overlapping schedules
                $overlappingSchedule = $this->checkForOverlappingSchedules(
                    $scheduleData['driver_id'],
                    $scheduleData['date'],
                    $scheduleData['start_time'],
                    $scheduleData['end_time']
                );
                if ($overlappingSchedule) {
                    throw new \Exception("Cannot create schedule: Driver '{$overlappingSchedule->driver->name}' already has a schedule from {$overlappingSchedule->start_time} to {$overlappingSchedule->end_time} on {$overlappingSchedule->date}. Please choose a different time.");
                }
                
                // ✅ Create the schedule WITHOUT notes field
                $schedule = Schedule::create([
                    'user_id' => auth()->id(),
                    'driver_id' => $scheduleData['driver_id'],
                    'route_id' => $scheduleData['route_id'],
                    'bus_id' => $scheduleData['bus_id'],
                    'date' => $scheduleData['date'],
                    'start_time' => $scheduleData['start_time'],
                    'end_time' => $scheduleData['end_time'],
                    'status' => 'scheduled',
                    'fare_regular' => $fare_regular,
                    'fare_aircon' => $fare_aircon,
                    // ✅ REMOVED: 'notes' => $scheduleData['notes'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $createdSchedules[] = $schedule;
            }
            DB::commit();
            return response()->json([
                'success' => true,
                'message' => count($createdSchedules) . ' schedule(s) created successfully!',
                'count' => count($createdSchedules)
            ], 201);
        } catch (ValidationException $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => collect($e->errors())->flatten()->first() ?? 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Error creating bulk schedules: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Helper method to check if a driver has any overlapping schedules
     * @param int $driverId
     * @param string $date
     * @param string $startTime
     * @param string $endTime
     * @param int|null $excludeId Schedule ID to exclude from check (for updates)
     * @return \App\Models\Schedule|null
     */
    private function checkForOverlappingSchedules($driverId, $date, $startTime, $endTime, $excludeId = null)
    {
        $query = Schedule::where('driver_id', $driverId)
            ->where('date', $date)
            ->where('start_time', '<', $endTime)
            ->where('end_time', '>', $startTime);

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->first();
    }



    // ===================================
    // API METHODS (return JSON responses for mobile app)
    // ===================================

    /**
     * Get all schedules (API - admin view)
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = Schedule::with(['route', 'bus', 'driver']);
            
            if ($request->has('status')) {
                $query->where('status', $request->status);
            }
            
            if ($request->has('date')) {
                $query->whereDate('date', $request->date);
            }
            
            if ($request->has('driver_id')) {
                $query->where('driver_id', $request->driver_id);
            }
            
            $perPage = $request->get('per_page', 15);
            $schedules = $query->orderBy('date', 'desc')
                             ->orderBy('start_time', 'asc')
                             ->paginate($perPage);
            
            return response()->json([
                'success' => true,
                'schedules' => $schedules
            ]);
            
        } catch (\Exception $e) {
            Log::error("Error fetching schedules: " . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error fetching schedules: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get driver schedules for mobile app (API)
     */
    public function getDriverSchedules($driverId): JsonResponse
    {
        try {
            $driver = Driver::find($driverId);
            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver not found'
                ], 404);
            }

            // ✅ Use Carbon to ensure consistent timezone handling
            $today = Carbon::now()->format('Y-m-d');
            
            Log::info("Getting schedules for driver {$driverId}, today is: {$today}");

            // Get all schedules for this driver (tickets for boarding list on map)
            $allSchedules = Schedule::with(['route', 'bus', 'tickets.commuter'])
                ->where('driver_id', $driverId)
                ->orderBy('date', 'desc')
                ->orderBy('start_time', 'asc')
                ->get();


            Log::info("Total schedules found: " . $allSchedules->count());

            // Categorize schedules based on date comparison
            $todaySchedules = $allSchedules->filter(function ($schedule) use ($today) {
                return $this->scheduleDateYmd($schedule) === $today;
            })->map(fn (Schedule $s) => $this->enrichScheduleForDriver($s))->values();

            $upcomingSchedules = $allSchedules->filter(function ($schedule) use ($today) {
                return $this->scheduleDateYmd($schedule) > $today;
            })->map(fn (Schedule $s) => $this->enrichScheduleForDriver($s))->values();

            $pastSchedules = $allSchedules->filter(function ($schedule) use ($today) {
                return $this->scheduleDateYmd($schedule) < $today;
            })->map(fn (Schedule $s) => $this->enrichScheduleForDriver($s))->values();

            Log::info("Categorized schedules - Today: {$todaySchedules->count()}, Upcoming: {$upcomingSchedules->count()}, Past: {$pastSchedules->count()}");

            return response()->json([
                'success' => true,
                'driver' => [
                    'id' => $driver->id,
                    'name' => $driver->name,
                    'email' => $driver->email
                ],
                'schedules' => [
                    'all' => $allSchedules->map(fn (Schedule $s) => $this->enrichScheduleForDriver($s))->values(),
                    'today' => $todaySchedules,
                    'upcoming' => $upcomingSchedules,
                    'past' => $pastSchedules
                ],
                'current_date' => $today // ✅ Return current date for debugging
            ]);
        } catch (\Exception $e) {
            Log::error("Error fetching schedules for driver {$driverId}: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching schedules: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Accept a schedule (API)
     */
    public function acceptSchedule(Request $request, $id)
    {
        try {
            $schedule = Schedule::findOrFail($id);

            // Update the schedule status to 'accepted'
            $schedule->status = 'accepted';
            $schedule->save();

            return response()->json([
                'success' => true,
                'message' => 'Schedule accepted successfully.',
                'schedule' => $schedule
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to accept schedule.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function declineSchedule($id)
    {
        try {
            $schedule = Schedule::findOrFail($id);
            $schedule->status = 'declined';
            $schedule->save();

            return response()->json([
                'success' => true,
                'message' => 'Schedule declined successfully',
                'schedule' => $schedule
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to decline schedule: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Start a schedule (API)
     */
    public function startSchedule($scheduleId): JsonResponse
    {
        try {
            Log::info("Attempting to start schedule ID: {$scheduleId}");

            $schedule = Schedule::find($scheduleId);

            if (!$schedule) {
                Log::error("Schedule not found: $scheduleId");
                return response()->json(['error' => 'Schedule not found'], 404);
            }

            $schedule = Schedule::with(['route', 'bus', 'driver'])->find($scheduleId);

            if (!$schedule) {
                return response()->json([
                    'success' => false,
                    'message' => 'Schedule not found'
                ], 404);
            }

            if ($schedule->status !== 'accepted') {
                return response()->json([
                    'success' => false,
                    'message' => "Cannot start schedule. Current status: {$schedule->status}. Schedule must be accepted first."
                ], 400);
            }

            $schedule->status = 'active';
            $schedule->started_at = Carbon::now();
            $schedule->save();

            Log::info("Schedule {$scheduleId} started by driver {$schedule->driver_id}");

            return response()->json([
                'success' => true,
                'message' => 'Trip started successfully',
                'schedule' => $schedule,
                'action' => 'started'
            ]);

        } catch (\Exception $e) {
            Log::error("Error starting schedule {$scheduleId}: " . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error starting schedule: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Complete a schedule (API)
     */
    public function completeSchedule($scheduleId): JsonResponse
    {
        try {
            Log::info("Attempting to complete schedule ID: {$scheduleId}");

            $schedule = Schedule::with(['route', 'bus', 'driver'])->find($scheduleId);
            
            if (!$schedule) {
                return response()->json([
                    'success' => false,
                    'message' => 'Schedule not found'
                ], 404);
            }

            Log::info("DEBUG: Schedule date={$schedule->date}, Today=" . Carbon::now()->format('Y-m-d'));

            if ($schedule->status !== 'active') {
                return response()->json([
                    'success' => false,
                    'message' => "Cannot complete schedule. Current status: {$schedule->status}. Schedule must be active."
                ], 400);
            }

            $schedule->status = 'completed';
            $schedule->completed_at = Carbon::now();
            $schedule->save();

            Log::info("Schedule {$scheduleId} completed by driver {$schedule->driver_id}");

            return response()->json([
                'success' => true,
                'message' => 'Trip completed successfully',
                'schedule' => $schedule,
                'action' => 'completed'
            ]);

        } catch (\Exception $e) {
            Log::error("Error completing schedule {$scheduleId}: " . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error completing schedule: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Assign schedule to driver (API - for admin use)
     */
    public function assignToDriver(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'driver_id' => 'required|exists:drivers,id',
                'route_id' => 'required|exists:routes,id',
                'bus_id' => 'required|exists:buses,id',
                'date' => 'required|date|after_or_equal:today',
                'start_time' => 'required|date_format:H:i',
                'end_time' => 'required|date_format:H:i|after:start_time',
                'fare_regular' => 'required|numeric|min:0',
                'fare_aircon' => 'nullable|numeric|min:0',
                'notes' => 'nullable|string|max:500'
            ]);

            // Check for overlapping schedules
            $overlappingSchedule = $this->checkForOverlappingSchedules(
                $request->driver_id,
                $request->date,
                $request->start_time,
                $request->end_time
            );

            if ($overlappingSchedule) {
                return response()->json([
                    'success' => false,
                    'message' => "Cannot assign schedule: Driver already has a schedule from {$overlappingSchedule->start_time} to {$overlappingSchedule->end_time} on {$overlappingSchedule->date}."
                ], 422);
            }

            $route = Route::findOrFail($request->route_id);
            $this->ensureRouteApprovedForOperator((int) $route->id, (int) $route->user_id);

            $schedule = Schedule::create([
                'user_id' => $route->user_id,

                'driver_id' => $request->driver_id,
                'route_id' => $request->route_id,
                'bus_id' => $request->bus_id,
                'date' => $request->date,
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
                'status' => 'scheduled',
                'fare_regular' => $request->fare_regular,
                'fare_aircon' => $request->fare_aircon ?? $request->fare_regular,
                'notes' => $request->notes
            ]);

            Log::info("New schedule created and assigned to driver {$request->driver_id}");

            return response()->json([
                'success' => true,
                'message' => 'Schedule assigned successfully',
                'schedule' => $schedule->load(['route', 'bus', 'driver'])
            ], 201);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => collect($e->errors())->flatten()->first() ?? 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error("Error assigning schedule: " . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error assigning schedule: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Routes the operator may assign to schedules: sysadmin-approved packages whose
     * {@see RouteApprovalRequest::$stop_configuration} includes at least one stop for that route
     * (same data commuters and drivers use for pathways and bus stops).
     *
     * @return array<int>
     */
    private function approvedRouteIdsForOperator(int $operatorUserId): array
    {
        $ids = [];

        RouteApprovalRequest::query()
            ->where('operator_user_id', $operatorUserId)
            ->where('status', 'approved')
            ->orderByDesc('decided_at')
            ->get()
            ->each(function (RouteApprovalRequest $pkg) use (&$ids): void {
                $config = $pkg->stop_configuration;
                if (! is_array($config)) {
                    return;
                }
                foreach ($config as $block) {
                    $routeId = (int) ($block['route_id'] ?? 0);
                    $stops = $block['stops'] ?? [];
                    if ($routeId <= 0 || ! is_array($stops) || count($stops) === 0) {
                        continue;
                    }
                    $ids[$routeId] = true;
                }
            });

        return array_map('intval', array_keys($ids));
    }

    private function ensureRouteApprovedForOperator(int $routeId, int $operatorUserId): void
    {
        $route = Route::where('user_id', $operatorUserId)->where('id', $routeId)->first();
        if (! $route) {
            throw ValidationException::withMessages([
                'route_id' => ['Invalid route for your account.'],
            ]);
        }

        $approved = $this->approvedRouteIdsForOperator($operatorUserId);
        if (! in_array((int) $routeId, $approved, true)) {
            throw ValidationException::withMessages([
                'route_id' => ['This route is not approved for scheduling yet. Complete terminal stops and sysadmin approval first.'],
            ]);
        }
    }

    /**
     * Friendly labels for schedules.0.* validation keys (shown in API/modal errors).
     *
     * @param  array<int|string, mixed>  $schedules
     * @return array<string, string>
     */
    private function bulkScheduleAttributeNames(array $schedules): array
    {
        $attributes = [];
        foreach (array_keys($schedules) as $i) {
            $n = (int) $i + 1;
            $attributes["schedules.{$i}.driver_id"] = "Schedule {$n} — driver";
            $attributes["schedules.{$i}.route_id"] = "Schedule {$n} — route";
            $attributes["schedules.{$i}.bus_id"] = "Schedule {$n} — bus";
            $attributes["schedules.{$i}.date"] = "Schedule {$n} — date";
            $attributes["schedules.{$i}.start_time"] = "Schedule {$n} — start time";
            $attributes["schedules.{$i}.end_time"] = "Schedule {$n} — end time";
        }

        return $attributes;
    }

    /**
     * Detect overlapping time ranges within the same bulk request (same driver + date).
     *
     * @param  array<int|string, array<string, mixed>>  $schedules
     */
    private function bulkDriverSchedulesOverlapInBatch(array $schedules): ?string
    {
        $byDriverDate = [];

        foreach ($schedules as $idx => $row) {
            if (! is_array($row)) {
                continue;
            }
            $driverId = isset($row['driver_id']) ? (int) $row['driver_id'] : null;
            $date = isset($row['date']) ? (string) $row['date'] : null;
            $start = isset($row['start_time']) ? trim((string) $row['start_time']) : '';
            $end = isset($row['end_time']) ? trim((string) $row['end_time']) : '';

            if (! $driverId || ! $date || $start === '' || $end === '') {
                continue;
            }

            $key = $driverId.'|'.$date;
            if (! isset($byDriverDate[$key])) {
                $byDriverDate[$key] = [];
            }

            $byDriverDate[$key][] = [
                'label' => (int) $idx + 1,
                'start' => $start,
                'end' => $end,
            ];
        }

        foreach ($byDriverDate as $items) {
            $count = count($items);
            for ($i = 0; $i < $count; $i++) {
                for ($j = $i + 1; $j < $count; $j++) {
                    if ($this->timeIntervalsOverlap($items[$i]['start'], $items[$i]['end'], $items[$j]['start'], $items[$j]['end'])) {
                        return 'Schedule '.$items[$i]['label'].' and Schedule '.$items[$j]['label'].' overlap on the same day for this driver. Choose different times.';
                    }
                }
            }
        }

        return null;
    }

    /**
     * Half-open style overlap: ranges touch at endpoint => NOT overlap for adjacent trips (optional).
     * Here we treat touching end=start as overlap-safe only if strictly &lt; / &gt; — matches DB query.
     */
    private function timeIntervalsOverlap(string $startA, string $endA, string $startB, string $endB): bool
    {
        return $startA < $endB && $endA > $startB;
    }

    private function assertScheduleStartNotInPast(string $date, string $startTime): void
    {
        try {
            $dt = Carbon::parse(trim($date).' '.trim($startTime));
        } catch (\Throwable $e) {
            return;
        }

        if ($dt->lt(now())) {
            throw ValidationException::withMessages([
                'start_time' => ['You cannot set a start time in the past. Choose a later time or a future date.'],
            ]);
        }
    }

    private function formatNowForMessage(): string
    {
        return now()->format('g:i A');
    }

    private function scheduleDateYmd(Schedule $schedule): string
    {
        if ($schedule->date instanceof \Carbon\CarbonInterface) {
            return $schedule->date->format('Y-m-d');
        }

        return Carbon::parse((string) $schedule->date)->format('Y-m-d');
    }

    /**
     * API payload for driver app: route pathway, terminal-approved stops, ticket holders.
     *
     * @return array<string, mixed>
     */
    private function enrichScheduleForDriver(Schedule $schedule): array
    {
        $schedule->loadMissing(['route', 'bus', 'tickets.commuter']);
        $data = $schedule->toArray();
        unset($data['tickets']);

        if ($schedule->route) {
            $data['route'] = $this->formatRouteForDriverResponse($schedule->route, (int) $schedule->user_id);
        }

        $data['boarding_passengers'] = $schedule->tickets->map(function ($t) {
            return [
                'public_ticket_id' => $t->public_ticket_id,
                'fare' => (float) $t->fare,
                'commuter_name' => $t->commuter?->name,
                'commuter_email' => $t->commuter?->email,
            ];
        })->values()->all();

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatRouteForDriverResponse(Route $route, int $operatorUserId): array
    {
        $base = $route->toArray();
        $line = $this->routeGeometryAsLineString($route);
        $base['map_geometry'] = $line;
        $base['stops'] = $this->approvedStopsForOperatorRoute($operatorUserId, (int) $route->id);

        return $base;
    }

    /**
     * Consistent GeoJSON LineString for Mapbox (lng, lat), or null.
     *
     * @return array{type: string, coordinates: list<array{0: float, 1: float}>}|null
     */
    private function routeGeometryAsLineString(?Route $route): ?array
    {
        if (! $route) {
            return null;
        }

        $g = $route->geometry;
        if (is_string($g)) {
            $decoded = json_decode($g, true);
            $g = is_array($decoded) ? $decoded : null;
        }

        if (! is_array($g)) {
            return null;
        }

        if (($g['type'] ?? null) === 'Feature' && isset($g['geometry']) && is_array($g['geometry'])) {
            $g = $g['geometry'];
        }

        if (($g['type'] ?? null) !== 'LineString' || ! isset($g['coordinates']) || ! is_array($g['coordinates'])) {
            return null;
        }

        $coords = [];
        foreach ($g['coordinates'] as $c) {
            if (! is_array($c) || count($c) < 2) {
                continue;
            }
            $coords[] = [(float) $c[0], (float) $c[1]];
        }

        if (count($coords) < 2) {
            return null;
        }

        return [
            'type' => 'LineString',
            'coordinates' => $coords,
        ];
    }

    /**
     * Terminal-approved stops for this operator route (same package logic as commuter approved routes).
     *
     * @return array<int, mixed>
     */
    private function approvedStopsForOperatorRoute(int $operatorUserId, int $routeId): array
    {
        $packages = RouteApprovalRequest::query()
            ->where('status', 'approved')
            ->where('operator_user_id', $operatorUserId)
            ->orderByDesc('decided_at')
            ->get();

        foreach ($packages as $pkg) {
            $routeIds = array_map('intval', (array) ($pkg->route_ids ?? []));
            if (! in_array($routeId, $routeIds, true)) {
                continue;
            }

            $config = $pkg->stop_configuration;
            if (! is_array($config)) {
                continue;
            }

            foreach ($config as $block) {
                if ((int) ($block['route_id'] ?? 0) !== $routeId) {
                    continue;
                }

                return $block['stops'] ?? [];
            }
        }

        return [];
    }
}
