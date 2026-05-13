<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Support\TicketBoarding;
use App\Models\Driver;
use App\Models\Notification;
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
            $buses = Bus::where('terminal', auth()->user()->terminal)
                ->where('bus_company', auth()->user()->company_name)
                ->get();
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
                ->paginate(10)
                ->withQueryString();

            // Avoid "empty" list when ?page= is beyond last page after filters change
            if ($schedules->isEmpty() && $schedules->total() > 0) {
                $qs = request()->query();
                $qs['page'] = max(1, $schedules->lastPage());

                return redirect()->route('schedule.panel', $qs);
            }

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
                'end_time' => 'required|date_format:H:i',
                'ends_next_day' => 'nullable|boolean',
                'status' => 'required|in:scheduled,active,completed,cancelled',
            ], [
                'date.after_or_equal' => 'The schedule date must be today or a future date.',
            ]);

            $endsNext = filter_var($validated['ends_next_day'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $this->assertScheduleTimeOrder($validated['date'], $validated['start_time'], $validated['end_time'], $endsNext);

            $this->assertScheduleStartNotInPast($validated['date'], $validated['start_time']);
            $this->assertSingleDailyCycle((int) $validated['driver_id'], (string) $validated['date']);

            // Check for overlapping schedules
            $overlappingSchedule = $this->checkForOverlappingSchedules(
                $validated['driver_id'],
                $validated['date'],
                $validated['start_time'],
                $validated['end_time'],
                null,
                $endsNext
            );

            if ($overlappingSchedule) {
                $msg = $this->scheduleOverlapMessage('create', $overlappingSchedule);
                if ($request->expectsJson()) {
                    return response()->json([
                        'success' => false,
                        'message' => $msg,
                    ], 422);
                }

                return redirect()->back()->with('error', $msg)->withInput();
            }

            $exactDuplicate = Schedule::where('driver_id', $validated['driver_id'])
                ->where('route_id', $validated['route_id'])
                ->where('bus_id', $validated['bus_id'])
                ->where('date', $validated['date'])
                ->where('start_time', $validated['start_time'])
                ->whereNotIn('status', ['cancelled', 'declined'])
                ->exists();
            if ($exactDuplicate) {
                if ($request->expectsJson()) {
                    return response()->json(['success' => false, 'message' => 'This schedule already exists for the selected driver, route, bus, date and time.'], 422);
                }
                return redirect()->back()->with('error', 'This schedule already exists for the selected driver, route, bus, date and time.')->withInput();
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
                'user_id' => auth()->id(),
                'driver_id' => $validated['driver_id'],
                'route_id' => $validated['route_id'],
                'bus_id' => $validated['bus_id'],
                'date' => $validated['date'],
                'start_time' => $validated['start_time'],
                'end_time' => $validated['end_time'],
                'ends_next_day' => $endsNext,
                'status' => 'scheduled',
                'fare_regular' => $fare_regular,
                'fare_aircon' => $fare_aircon,
                'trip_leg' => 1,
                'leg_status' => 'pending',
                'return_trip_status' => !empty($route?->return_geometry) ? 'pending' : null,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            Notification::create([
                'type'        => 'schedule_update',
                'message'     => 'You have been assigned a new schedule: ' . ($route->name ?? 'Unknown Route') . ' on ' . $validated['date'] . ' from ' . $validated['start_time'] . ' to ' . $validated['end_time'] . '.',
                'sender_id'   => auth()->id(),
                'driver_id'   => $validated['driver_id'],
                'schedule_id' => $schedule->id,
                'is_read'     => false,
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
                'end_time' => 'required|date_format:H:i',
                'ends_next_day' => 'nullable|boolean',
                'status' => 'required|in:scheduled,active,completed,cancelled,accepted,declined',
            ]);

            $validated['ends_next_day'] = $request->boolean('ends_next_day');
            $endsNext = (bool) $validated['ends_next_day'];
            $this->assertScheduleTimeOrder($validated['date'], $validated['start_time'], $validated['end_time'], $endsNext);

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
            $this->assertSingleDailyCycle((int) $validated['driver_id'], (string) $validated['date'], (int) $schedule->id);

            // Check for overlapping schedules (exclude current schedule)
            $overlappingSchedule = $this->checkForOverlappingSchedules(
                $validated['driver_id'],
                $validated['date'],
                $validated['start_time'],
                $validated['end_time'],
                $schedule->id,
                $endsNext
            );

            if ($overlappingSchedule) {
                $msg = $this->scheduleOverlapMessage('update', $overlappingSchedule);
                if ($request->expectsJson()) {
                    return response()->json([
                        'success' => false,
                        'message' => $msg,
                    ], 422);
                }

                return redirect()->back()->with('error', $msg)->withInput();
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
            'schedules.*.ends_next_day' => 'nullable|boolean',
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
                        $endsNext = filter_var($row['ends_next_day'] ?? false, FILTER_VALIDATE_BOOLEAN);
                        [$startAt, $endAt] = $this->resolveScheduleWindowBounds((string) $date, (string) $start, (string) $end, $endsNext);
                        if ($endAt->lte($startAt)) {
                            $validator->errors()->add(
                                "schedules.{$i}.end_time",
                                "Schedule {$n}: end time must be after start time. For times after midnight, enable next-day end (set automatically when route duration crosses midnight)."
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
                
                $endsNextBulk = filter_var($scheduleData['ends_next_day'] ?? false, FILTER_VALIDATE_BOOLEAN);
                $this->assertSingleDailyCycle((int) $scheduleData['driver_id'], (string) $scheduleData['date']);

                // Check for overlapping schedules
                $overlappingSchedule = $this->checkForOverlappingSchedules(
                    $scheduleData['driver_id'],
                    $scheduleData['date'],
                    $scheduleData['start_time'],
                    $scheduleData['end_time'],
                    null,
                    $endsNextBulk
                );
                if ($overlappingSchedule) {
                    throw new \Exception($this->scheduleOverlapMessage('create', $overlappingSchedule));
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
                    'ends_next_day' => $endsNextBulk,
                    'status' => 'scheduled',
                    'fare_regular' => $fare_regular,
                    'fare_aircon' => $fare_aircon,
                    'trip_leg' => 1,
                    'leg_status' => 'pending',
                    'return_trip_status' => !empty($route?->return_geometry) ? 'pending' : null,
                    // ✅ REMOVED: 'notes' => $scheduleData['notes'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                Notification::create([
                    'type'        => 'schedule_update',
                    'message'     => 'You have been assigned a new schedule: ' . ($route->name ?? 'Unknown Route') . ' on ' . $scheduleData['date'] . ' from ' . $scheduleData['start_time'] . ' to ' . $scheduleData['end_time'] . '.',
                    'sender_id'   => auth()->id(),
                    'driver_id'   => $scheduleData['driver_id'],
                    'schedule_id' => $schedule->id,
                    'is_read'     => false,
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
     * Real start/end instants. If ends_next_day, end clock applies to the calendar day after `date`.
     *
     * @return array{0: \Carbon\Carbon, 1: \Carbon\Carbon}
     */
    private function resolveScheduleWindowBounds(string $dateYmd, string $startHi, string $endHi, bool $endsNextDay): array
    {
        $startHi = substr(trim($startHi), 0, 5);
        $endHi = substr(trim($endHi), 0, 5);
        $startAt = Carbon::parse(trim($dateYmd).' '.$startHi);
        $endAt = Carbon::parse(trim($dateYmd).' '.$endHi);
        if ($endsNextDay) {
            $endAt->addDay();
        }

        return [$startAt, $endAt];
    }

    private function assertScheduleTimeOrder(string $date, string $start, string $end, bool $endsNextDay): void
    {
        [$startAt, $endAt] = $this->resolveScheduleWindowBounds($date, $start, $end, $endsNextDay);
        if ($endAt->lte($startAt)) {
            throw ValidationException::withMessages([
                'end_time' => ['End time must be after start time. For trips that finish after midnight, turn on “end is next day” (or let the form set it when duration crosses midnight).'],
            ]);
        }
    }

    /**
     * Only trips that still "hold" the driver block double-booking. Finished or declined trips do not.
     *
     * @param  int|null  $excludeId  Schedule ID to exclude from check (for updates)
     */
    private function checkForOverlappingSchedules($driverId, $date, $startTime, $endTime, $excludeId = null, bool $endsNextDay = false)
    {
        [$newStart, $newEnd] = $this->resolveScheduleWindowBounds((string) $date, (string) $startTime, (string) $endTime, $endsNextDay);

        $from = $newStart->copy()->subDay()->format('Y-m-d');
        $to = $newEnd->copy()->format('Y-m-d');

        $candidates = Schedule::query()
            ->where('driver_id', $driverId)
            ->whereBetween('date', [$from, $to])
            ->whereNotIn('status', ['completed', 'cancelled', 'declined']);

        if ($excludeId) {
            $candidates->where('id', '!=', $excludeId);
        }

        foreach ($candidates->cursor() as $existing) {
            $d = $existing->date instanceof \Carbon\CarbonInterface
                ? $existing->date->format('Y-m-d')
                : Carbon::parse((string) $existing->date)->format('Y-m-d');
            $st = $existing->start_time instanceof \Carbon\CarbonInterface
                ? $existing->start_time->format('H:i')
                : Carbon::parse((string) $existing->start_time)->format('H:i');
            $en = $existing->end_time instanceof \Carbon\CarbonInterface
                ? $existing->end_time->format('H:i')
                : Carbon::parse((string) $existing->end_time)->format('H:i');
            [$exStart, $exEnd] = $this->resolveScheduleWindowBounds($d, $st, $en, (bool) ($existing->ends_next_day ?? false));

            if ($newStart->lt($exEnd) && $newEnd->gt($exStart)) {
                return $existing->loadMissing(['driver', 'route']);
            }
        }

        return null;
    }

    private function scheduleOverlapMessage(string $action, Schedule $conflict): string
    {
        $verb = $action === 'update' ? 'update this schedule' : 'create this schedule';
        $driverName = $conflict->driver?->name ?? 'This driver';
        $routeName = $conflict->route?->name ?? 'a route';
        $status = $conflict->status ?? 'unknown';

        return "Cannot {$verb}: {$driverName} already has a {$status} trip ({$routeName}) from {$conflict->start_time} to {$conflict->end_time} on {$conflict->date}. Choose a different time, or finish or cancel the existing trip first.";
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

            // Auto-expire: any 'active' schedule whose window ended more than 2 hours ago
            $now = Carbon::now();
            foreach ($allSchedules->where('status', 'active') as $stale) {
                [, $windowEnd] = $stale->windowBounds();
                if ($windowEnd->copy()->addHours(2)->lt($now)) {
                    $stale->status = 'completed';
                    $stale->completed_at = $stale->completed_at ?? $windowEnd;
                    $stale->save();
                }
            }

            // Categorize by real trip window (handles ends_next_day / past-midnight trips)
            $startOfToday = Carbon::today()->startOfDay();
            $endOfToday = Carbon::today()->copy()->endOfDay();

            $todaySchedules = $allSchedules->filter(function ($schedule) use ($startOfToday, $endOfToday) {
                [$s, $e] = $schedule->windowBounds();

                return $s->lte($endOfToday) && $e->gte($startOfToday);
            })->map(fn (Schedule $s) => $this->enrichScheduleForDriver($s))->values();

            $upcomingSchedules = $allSchedules->filter(function ($schedule) use ($endOfToday) {
                [$s, $e] = $schedule->windowBounds();

                return $s->gt($endOfToday);
            })->map(fn (Schedule $s) => $this->enrichScheduleForDriver($s))->values();

            $pastSchedules = $allSchedules->filter(function ($schedule) use ($startOfToday) {
                [$s, $e] = $schedule->windowBounds();

                return $e->lt($startOfToday);
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
     * Accept a schedule or the next leg (API)
     * Handles both: initial schedule acceptance (status=scheduled) and
     * mid-day next-leg acceptance (status=active, leg_status=pending).
     */
    public function acceptSchedule(Request $request, $id)
    {
        try {
            $schedule = Schedule::findOrFail($id);
            $legStatus = $schedule->leg_status ?? 'pending';

            if ($schedule->status === 'scheduled' && $legStatus === 'pending') {
                // Initial acceptance of the day's schedule
                $schedule->status     = 'accepted';
                $schedule->leg_status = 'accepted';
            } elseif ($schedule->status === 'active' && $legStatus === 'pending') {
                // Accepting the next leg in a vice-versa cycle
                $schedule->leg_status = 'accepted';
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot accept schedule in its current state.',
                ], 400);
            }

            $schedule->save();

            return response()->json([
                'success' => true,
                'message' => 'Schedule accepted successfully.',
                'schedule' => $schedule,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to accept schedule.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    public function declineSchedule(Request $request, $id)
    {
        $request->validate(['reason' => 'required|string|min:5|max:500']);

        $schedule = Schedule::with('driver')->findOrFail($id);

        if ($schedule->status !== 'scheduled') {
            return response()->json(['success' => false, 'message' => 'Only unaccepted schedules can be declined.'], 400);
        }

        $schedule->status = 'pending_decline';
        $schedule->decline_reason = $request->reason;
        $schedule->decline_status = 'pending_approval';
        $schedule->save();

        $driverName = $schedule->driver
            ? trim(($schedule->driver->first_name ?? '') . ' ' . ($schedule->driver->last_name ?? ''))
            : 'Driver';

        Notification::create([
            'type'         => 'schedule_update',
            'message'      => "Driver {$driverName} declined schedule #{$id}: \"{$request->reason}\"",
            'driver_id'    => $schedule->driver_id,
            'schedule_id'  => $id,
            'recipient_id' => $schedule->user_id,
            'sender_id'    => null,
        ]);

        return response()->json(['success' => true, 'message' => 'Decline request submitted. Awaiting operator approval.']);
    }

    public function approveDecline($id): JsonResponse
    {
        $schedule = Schedule::with('driver')->findOrFail($id);

        $schedule->status = 'declined';
        $schedule->decline_status = 'approved';
        $schedule->declined_at = now();
        $schedule->save();

        Notification::create([
            'type'        => 'schedule_update',
            'message'     => "Your decline request for schedule #{$id} has been approved.",
            'driver_id'   => $schedule->driver_id,
            'schedule_id' => $id,
            'sender_id'   => $schedule->user_id,
        ]);

        return response()->json(['success' => true, 'message' => 'Decline approved.']);
    }

    public function rejectDecline($id): JsonResponse
    {
        $schedule = Schedule::with('driver')->findOrFail($id);

        $schedule->status = 'scheduled';
        $schedule->decline_status = 'rejected';
        $schedule->decline_reason = null;
        $schedule->save();

        Notification::create([
            'type'        => 'schedule_update',
            'message'     => "Your decline request for schedule #{$id} was rejected. Please proceed with your schedule.",
            'driver_id'   => $schedule->driver_id,
            'schedule_id' => $id,
            'sender_id'   => $schedule->user_id,
        ]);

        return response()->json(['success' => true, 'message' => 'Decline rejected. Schedule restored.']);
    }

    /**
     * Start the current leg (API)
     * Works for any leg (outbound or return) — checks leg_status='accepted'.
     */
    public function startSchedule($scheduleId): JsonResponse
    {
        try {
            Log::info("Attempting to start schedule ID: {$scheduleId}");

            $schedule = Schedule::with(['route', 'bus', 'driver'])->find($scheduleId);

            if (!$schedule) {
                Log::error("Schedule not found: $scheduleId");
                return response()->json(['success' => false, 'message' => 'Schedule not found'], 404);
            }

            $legStatus = $schedule->leg_status ?? '';
            $tripLeg   = $schedule->trip_leg  ?? 1;

            if ($legStatus !== 'accepted') {
                return response()->json([
                    'success' => false,
                    'message' => "Cannot start: leg must be accepted first. Current leg_status: {$legStatus}",
                ], 400);
            }

            if ($schedule->status !== 'active') {
                $schedule->status     = 'active';
                $schedule->started_at = Carbon::now();
            }
            $schedule->leg_status = 'active';

            if ($tripLeg % 2 === 0) {
                $schedule->return_trip_status = 'active';
            }

            $schedule->save();

            Log::info("Schedule {$scheduleId} leg {$tripLeg} started by driver {$schedule->driver_id}");

            return response()->json([
                'success' => true,
                'message' => 'Trip started successfully',
                'schedule' => $schedule,
                'action'  => 'started',
            ]);
        } catch (\Exception $e) {
            Log::error("Error starting schedule {$scheduleId}: " . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error starting schedule: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function updatePosition(Request $request, $id): JsonResponse
    {
        $schedule = Schedule::findOrFail($id);
        $data = $request->validate([
            'latitude'  => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);
        $schedule->current_lat = $data['latitude'];
        $schedule->current_lng = $data['longitude'];
        $schedule->save();
        return response()->json(['success' => true]);
    }

    /**
     * Complete the current active leg (API)
     * For routes with return_geometry: advances to the next leg (vice-versa loop).
     * For one-way routes: truly completes the schedule.
     */
    public function completeSchedule($scheduleId): JsonResponse
    {
        try {
            Log::info("Attempting to complete schedule ID: {$scheduleId}");

            $schedule = Schedule::with(['route', 'bus', 'driver'])->find($scheduleId);

            if (!$schedule) {
                return response()->json(['success' => false, 'message' => 'Schedule not found'], 404);
            }

            if ($schedule->status === 'completed') {
                return response()->json(['success' => true, 'message' => 'Schedule already completed']);
            }

            $legStatus = $schedule->leg_status ?? '';
            if ($legStatus !== 'active') {
                return response()->json([
                    'success' => false,
                    'message' => "Cannot complete: leg is not active. Current leg_status: {$legStatus}",
                ], 400);
            }

            $route = Route::find($schedule->route_id);
            $hasReturnGeometry = $route && !empty($route->return_geometry);

            if ($hasReturnGeometry) {
                // Advance to the next leg — vice-versa loop continues
                $nextLeg = ($schedule->trip_leg ?? 1) + 1;
                $schedule->trip_leg   = $nextLeg;
                $schedule->leg_status = 'pending';
                $schedule->return_trip_status = 'pending';
                $msg = ($nextLeg % 2 === 0)
                    ? 'Outbound leg completed. Accept the return trip to continue.'
                    : 'Return leg completed. Accept the next outbound trip to continue.';

                $schedule->save();

                Notification::create([
                    'type'        => 'schedule_update',
                    'message'     => $msg,
                    'sender_id'   => $schedule->user_id,
                    'driver_id'   => $schedule->driver_id,
                    'schedule_id' => $schedule->id,
                    'is_read'     => false,
                ]);

                Log::info("Schedule {$scheduleId} leg completed, now at leg {$nextLeg}");

                return response()->json([
                    'success' => true,
                    'message' => $msg,
                    'schedule' => $schedule,
                ]);
            }

            // No return geometry — truly complete the schedule for the day
            $schedule->status       = 'completed';
            $schedule->completed_at = Carbon::now();
            $schedule->leg_status   = 'completed';
            $schedule->save();

            Log::info("Schedule {$scheduleId} fully completed by driver {$schedule->driver_id}");

            return response()->json([
                'success' => true,
                'message' => 'Trip completed successfully',
                'schedule' => $schedule,
                'action'  => 'completed',
            ]);
        } catch (\Exception $e) {
            Log::error("Error completing schedule {$scheduleId}: " . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error completing schedule: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function acceptReturnTrip($id): JsonResponse
    {
        $schedule = Schedule::findOrFail($id);
        if ($schedule->return_trip_status !== 'pending') {
            return response()->json(['success' => false, 'message' => 'Return trip is not awaiting acceptance.'], 400);
        }
        $schedule->return_trip_status = 'accepted';
        $schedule->save();
        return response()->json(['success' => true, 'message' => 'Return trip accepted.', 'schedule' => $schedule]);
    }

    public function declineReturnTrip($id): JsonResponse
    {
        $schedule = Schedule::findOrFail($id);
        if (! in_array($schedule->return_trip_status, ['pending', 'accepted'])) {
            return response()->json(['success' => false, 'message' => 'Return trip cannot be declined in its current state.'], 400);
        }
        $schedule->return_trip_status = 'declined';
        $schedule->save();
        return response()->json(['success' => true, 'message' => 'Return trip declined.']);
    }

    public function startReturnTrip($id): JsonResponse
    {
        $schedule = Schedule::with('route')->findOrFail($id);
        if ($schedule->return_trip_status !== 'accepted') {
            return response()->json(['success' => false, 'message' => 'Return trip must be accepted before starting.'], 400);
        }
        $schedule->return_trip_status = 'active';
        $schedule->save();
        return response()->json(['success' => true, 'message' => 'Return trip started.', 'schedule' => $schedule]);
    }

    public function completeReturnTrip($id): JsonResponse
    {
        // In the vice-versa system completing a return leg = completing any leg.
        return $this->completeSchedule($id);
    }

    /**
     * Driver ends their day — truly completes the schedule regardless of current leg.
     */
    public function endDay($id): JsonResponse
    {
        try {
            $schedule = Schedule::findOrFail($id);

            if ($schedule->status === 'completed') {
                return response()->json(['success' => true, 'message' => 'Schedule already completed.']);
            }

            $schedule->status       = 'completed';
            $schedule->completed_at = Carbon::now();
            $schedule->leg_status   = 'completed';
            $schedule->save();

            return response()->json([
                'success' => true,
                'message' => 'Day ended. Schedule marked as completed.',
                'schedule' => $schedule,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error ending day: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Driver cancels an accepted/active schedule with a reason.
     * Sets status to 'cancelled' and cancellation_status to 'pending_approval'.
     * Notifies the operator.
     */
    public function cancelSchedule(Request $request, $id): JsonResponse
    {
        $request->validate(['reason' => 'required|string|min:5|max:500']);

        $schedule = Schedule::with('driver')->findOrFail($id);

        if (!in_array($schedule->status, ['accepted', 'active', 'scheduled'])) {
            return response()->json(['success' => false, 'message' => 'Schedule cannot be cancelled in its current status.'], 400);
        }

        $schedule->status = 'cancelled';
        $schedule->cancel_reason = $request->reason;
        $schedule->cancellation_status = 'pending_approval';
        $schedule->save();

        $driverName = $schedule->driver
            ? trim(($schedule->driver->first_name ?? '') . ' ' . ($schedule->driver->last_name ?? ''))
            : 'Driver';

        Notification::create([
            'type'         => 'schedule_cancellation',
            'message'      => "Driver {$driverName} cancelled schedule #{$id}: \"{$request->reason}\"",
            'driver_id'    => $schedule->driver_id,
            'schedule_id'  => $id,
            'recipient_id' => $schedule->user_id,
            'sender_id'    => null,
        ]);

        return response()->json(['success' => true, 'message' => 'Cancellation submitted. Awaiting operator approval.']);
    }

    /**
     * Operator approves a driver's cancellation request.
     * Sets cancellation_status to 'approved' and notifies the driver.
     */
    public function approveCancellation($id): JsonResponse
    {
        $schedule = Schedule::with('driver')->findOrFail($id);

        $schedule->cancellation_status = 'approved';
        $schedule->save();

        Notification::create([
            'type'        => 'schedule_update',
            'message'     => "Your cancellation request for schedule #{$id} has been approved by the operator.",
            'driver_id'   => $schedule->driver_id,
            'schedule_id' => $id,
            'sender_id'   => $schedule->user_id,
        ]);

        return response()->json(['success' => true, 'message' => 'Cancellation approved.']);
    }

    /**
     * Operator rejects a driver's cancellation request.
     * Restores status to 'accepted' and notifies the driver.
     */
    public function rejectCancellation($id): JsonResponse
    {
        $schedule = Schedule::with('driver')->findOrFail($id);

        $schedule->status = 'accepted';
        $schedule->cancellation_status = 'rejected';
        $schedule->cancel_reason = null;
        $schedule->save();

        Notification::create([
            'type'        => 'schedule_update',
            'message'     => "Your cancellation request for schedule #{$id} was rejected. Please proceed with your schedule.",
            'driver_id'   => $schedule->driver_id,
            'schedule_id' => $id,
            'sender_id'   => $schedule->user_id,
        ]);

        return response()->json(['success' => true, 'message' => 'Cancellation rejected. Schedule restored.']);
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
                'end_time' => 'required|date_format:H:i',
                'ends_next_day' => 'nullable|boolean',
                'fare_regular' => 'required|numeric|min:0',
                'fare_aircon' => 'nullable|numeric|min:0',
                'notes' => 'nullable|string|max:500'
            ]);

            $endsNextAssign = filter_var($request->input('ends_next_day'), FILTER_VALIDATE_BOOLEAN);
            $this->assertSingleDailyCycle((int) $request->driver_id, Carbon::parse($request->date)->format('Y-m-d'));
            $this->assertScheduleTimeOrder(
                Carbon::parse($request->date)->format('Y-m-d'),
                $request->start_time,
                $request->end_time,
                $endsNextAssign
            );

            // Check for overlapping schedules
            $overlappingSchedule = $this->checkForOverlappingSchedules(
                $request->driver_id,
                $request->date,
                $request->start_time,
                $request->end_time,
                null,
                $endsNextAssign
            );

            if ($overlappingSchedule) {
                return response()->json([
                    'success' => false,
                    'message' => $this->scheduleOverlapMessage('create', $overlappingSchedule),
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
                'ends_next_day' => $endsNextAssign,
                'status' => 'scheduled',
                'fare_regular' => $request->fare_regular,
                'fare_aircon' => $request->fare_aircon ?? $request->fare_regular,
                'notes' => $request->notes,
                'trip_leg' => 1,
                'leg_status' => 'pending',
                'return_trip_status' => !empty($route?->return_geometry) ? 'pending' : null,
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
     * Route IDs from sysadmin-approved packages for this operator.
     * Uses the route_ids column directly rather than parsing stop_configuration.
     *
     * @return array<int>
     */
    private function approvedRouteIdsForOperator(int $operatorUserId): array
    {
        $ids = [];

        RouteApprovalRequest::query()
            ->where('operator_user_id', $operatorUserId)
            ->where('status', 'approved')
            ->get()
            ->each(function (RouteApprovalRequest $pkg) use (&$ids): void {
                foreach ((array) ($pkg->route_ids ?? []) as $routeId) {
                    $id = (int) $routeId;
                    if ($id > 0) {
                        $ids[$id] = true;
                    }
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
            $attributes["schedules.{$i}.ends_next_day"] = "Schedule {$n} — ends next day";
        }

        return $attributes;
    }

    /**
     * Detect overlapping real time ranges within the same bulk request (same driver).
     *
     * @param  array<int|string, array<string, mixed>>  $schedules
     */
    private function bulkDriverSchedulesOverlapInBatch(array $schedules): ?string
    {
        $byDriver = [];
        $byDriverDay = [];

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

            $endsNext = filter_var($row['ends_next_day'] ?? false, FILTER_VALIDATE_BOOLEAN);
            try {
                [$sAt, $eAt] = $this->resolveScheduleWindowBounds($date, $start, $end, $endsNext);
            } catch (\Throwable) {
                continue;
            }

            if (! isset($byDriver[$driverId])) {
                $byDriver[$driverId] = [];
            }
            $dayKey = $driverId.'|'.$date;
            if (! isset($byDriverDay[$dayKey])) {
                $byDriverDay[$dayKey] = [];
            }
            $byDriverDay[$dayKey][] = (int) $idx + 1;

            $byDriver[$driverId][] = [
                'label' => (int) $idx + 1,
                's' => $sAt,
                'e' => $eAt,
            ];
        }

        foreach ($byDriverDay as $labels) {
            if (count($labels) > 1) {
                return 'Only one schedule cycle is allowed per driver per day. Conflicting rows: '.implode(', ', $labels).'.';
            }
        }

        foreach ($byDriver as $items) {
            $count = count($items);
            for ($i = 0; $i < $count; $i++) {
                for ($j = $i + 1; $j < $count; $j++) {
                    if ($items[$i]['s']->lt($items[$j]['e']) && $items[$i]['e']->gt($items[$j]['s'])) {
                        return 'Schedule '.$items[$i]['label'].' and Schedule '.$items[$j]['label'].' overlap for this driver. Choose different times.';
                    }
                }
            }
        }

        return null;
    }

    private function assertSingleDailyCycle(int $driverId, string $date, ?int $excludeScheduleId = null): void
    {
        $query = Schedule::query()
            ->where('driver_id', $driverId)
            ->whereDate('date', $date)
            ->whereNotIn('status', ['cancelled', 'declined']);

        if ($excludeScheduleId !== null) {
            $query->where('id', '!=', $excludeScheduleId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'driver_id' => ['Only one schedule cycle per driver per day is allowed.'],
            ]);
        }
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

        $tripLeg   = $schedule->trip_leg  ?? 1;
        $legStatus = $schedule->leg_status ?? 'pending';
        $data['trip_leg']          = $tripLeg;
        $data['leg_status']        = $legStatus;
        $data['leg_direction']     = ($tripLeg % 2 === 1) ? 'outbound' : 'return';
        $data['has_return_trip']   = ! empty($schedule->route?->return_geometry);
        $data['return_trip_status'] = $schedule->return_trip_status;

        $stillAboard = $schedule->tickets->filter(fn ($t) => $t->alighted_at === null);

        $data['boarding_passengers'] = $stillAboard->map(function ($t) {
            return [
                'public_ticket_id' => $t->public_ticket_id,
                'fare' => (float) $t->fare,
                'commuter_name' => $t->commuter?->name,
                'commuter_email' => $t->commuter?->email,
            ];
        })->values()->all();

        $cap = (int) ($schedule->bus?->capacity ?? 0);
        $data['aboard_count'] = TicketBoarding::aboardCount($schedule->tickets, $cap);
        $data['tickets_sold_count'] = $schedule->tickets->count();

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

        if (! empty($route->return_geometry)) {
            $rg = $route->return_geometry;
            if (is_string($rg)) {
                $rg = json_decode($rg, true);
            }
            if (is_array($rg)) {
                if (($rg['type'] ?? null) === 'Feature' && isset($rg['geometry'])) {
                    $rg = $rg['geometry'];
                }
                if (($rg['type'] ?? null) === 'LineString' && isset($rg['coordinates'])) {
                    $coords = [];
                    foreach ($rg['coordinates'] as $c) {
                        if (is_array($c) && count($c) >= 2) {
                            $coords[] = [(float) $c[0], (float) $c[1]];
                        }
                    }
                    if (count($coords) >= 2) {
                        $base['return_map_geometry'] = ['type' => 'LineString', 'coordinates' => $coords];
                    }
                }
            }
            $base['return_stops'] = $route->return_stops_data ?? [];
        }

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
     * Terminal-approved stops for this operator's route.
     * Matches block by route_id key if present, otherwise by position in route_ids array.
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
            $position = array_search($routeId, $routeIds, true);
            if ($position === false) {
                continue;
            }

            $config = $pkg->stop_configuration;
            if (! is_array($config) || count($config) === 0) {
                continue;
            }

            // Match by route_id key in block (preferred format)
            foreach ($config as $block) {
                if ((int) ($block['route_id'] ?? -1) === $routeId) {
                    return $block['stops'] ?? [];
                }
            }

            // Fallback: match by position in route_ids array
            if (isset($config[$position]) && is_array($config[$position]['stops'] ?? null)) {
                return $config[$position]['stops'];
            }

            // Last resort: return first block's stops
            return $config[0]['stops'] ?? [];
        }

        return [];
    }
}
