<?php

namespace App\Http\Controllers;

use App\Models\Route;
use App\Models\RouteApprovalRequest;
use App\Models\Schedule;
use App\Models\Ticket;
use App\Models\DriverLocation;
use App\Models\Commuter;
use App\Models\Notification;
use App\Support\TicketBoarding;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CommuterRoutesController extends Controller
{
    private function computeStopEtas(?Route $route, array $stops, ?Schedule $schedule = null): array
    {
        $fullKm = max((float) ($route?->distance_km ?? 0), 0.001);
        $durationMin = (int) ($route?->estimated_duration ?? 0);

        $start = null;
        if ($schedule && $schedule->date && $schedule->start_time) {
            try {
                $day = $schedule->date instanceof \Carbon\CarbonInterface
                    ? $schedule->date->format('Y-m-d')
                    : \Carbon\Carbon::parse((string) $schedule->date)->format('Y-m-d');
                $t = $schedule->start_time instanceof \Carbon\CarbonInterface
                    ? $schedule->start_time->format('H:i:s')
                    : \Carbon\Carbon::parse((string) $schedule->start_time)->format('H:i:s');
                $start = \Carbon\Carbon::parse("{$day} {$t}");
            } catch (\Throwable) {
                $start = null;
            }
        }

        $out = [];
        foreach ($stops as $s) {
            $dist = (float) ($s['distance_km_from_start'] ?? 0);
            $ratio = min(1.0, max(0.0, $dist / $fullKm));
            $etaMin = $durationMin > 0 ? (int) round($durationMin * $ratio) : null;
            $etaTime = ($start && $etaMin !== null) ? $start->copy()->addMinutes($etaMin)->format('H:i') : null;

            $s['eta_minutes_from_start'] = $etaMin;
            $s['eta_time'] = $etaTime;
            $out[] = $s;
        }

        return $out;
    }

    /**
     * Approved routes with terminal-manager stops (public API for commuter app).
     */
    public function approvedRoutes(Request $request)
    {
        $terminal = $request->query('terminal', 'north');
        $busType = $request->query('bus_type', 'regular');

        if (! in_array($busType, ['regular', 'aircon'], true)) {
            $busType = 'regular';
        }

        $packages = RouteApprovalRequest::query()
            ->where('status', 'approved')
            ->where('terminal', $terminal)
            ->orderByDesc('decided_at')
            ->get();

        $routes = [];
        $seenRouteIds = [];

        foreach ($packages as $pkg) {
            $config = $pkg->stop_configuration;
            if (! is_array($config)) {
                continue;
            }

            foreach ($config as $block) {
                $routeId = $block['route_id'] ?? null;
                if (! $routeId) {
                    continue;
                }

                $route = Route::query()->find($routeId);
                if (! $route || ($route->bus_type ?? 'regular') !== $busType) {
                    continue;
                }

                if (isset($seenRouteIds[$routeId])) {
                    continue;
                }
                $seenRouteIds[$routeId] = true;

                $geometry = $route->geometry;
                if (is_string($geometry)) {
                    $geometry = json_decode($geometry, true);
                }

                $schedule = $this->findTodaysBookableScheduleForRoute((int) $route->id);

                $stops = $block['stops'] ?? [];
                if (is_array($stops) && count($stops) > 0) {
                    $stops = $this->computeStopEtas($route, $stops, $schedule);
                }

                $routes[] = [
                    'approval_request_id' => $pkg->id,
                    'route_id' => $route->id,
                    'schedule_id' => $schedule?->id,
                    'name' => $route->name,
                    'code' => $route->code,
                    'bus_type' => $route->bus_type,
                    'geometry' => $geometry,
                    'distance_km' => (float) ($route->distance_km ?? 0),
                    'estimated_duration' => (int) ($route->estimated_duration ?? 0),
                    'regular_price' => (float) ($route->regular_price ?? $route->route_fare ?? 0),
                    'aircon_price' => (float) ($route->aircon_price ?? $route->route_fare ?? 0),
                    'stops' => $stops,
                    'label' => $block['label'] ?? $route->name,
                ];
            }
        }

        return response()->json([
            'routes' => $routes,
            'terminal' => $terminal,
            'bus_type' => $busType,
        ]);
    }

    /**
     * Fare to pay when alighting at a specific stop (distance-proportional).
     */
    public function farePreview(Request $request)
    {
        $data = $request->validate([
            'route_id' => ['required', 'integer', 'exists:routes,id'],
            'bus_type' => ['required', 'in:regular,aircon'],
            'stop_index' => ['required', 'integer', 'min:0'],
            'approval_request_id' => ['nullable', 'integer', 'exists:route_approval_requests,id'],
            'commuter_id' => ['nullable', 'integer', 'exists:commuters,id'],
        ]);

        $route = Route::query()->findOrFail($data['route_id']);

        $pkg = null;
        if (! empty($data['approval_request_id'])) {
            $pkg = RouteApprovalRequest::query()
                ->where('status', 'approved')
                ->find($data['approval_request_id']);
        }
        if (! $pkg) {
            $pkg = RouteApprovalRequest::query()
                ->where('status', 'approved')
                ->orderByDesc('decided_at')
                ->get()
                ->first(function ($p) use ($data) {
                    return in_array((int) $data['route_id'], $p->route_ids ?? [], true);
                });
        }

        $fullKm = max((float) ($route->distance_km ?? 0), 0.001);

        $stopDist = $fullKm;
        $selectedStop = null;

        if ($pkg && is_array($pkg->stop_configuration)) {
            foreach ($pkg->stop_configuration as $block) {
                if ((int) ($block['route_id'] ?? 0) !== (int) $data['route_id']) {
                    continue;
                }
                $stops = $block['stops'] ?? [];
                $idx = $data['stop_index'];
                if (! isset($stops[$idx])) {
                    continue;
                }
                $selectedStop = $stops[$idx];
                $stopDist = (float) ($selectedStop['distance_km_from_start'] ?? $fullKm);
                break;
            }
        }

        $km = max(0.0, (float) $stopDist);
        $type = $this->resolvePassengerType($data);
        $isDiscounted = in_array($type, ['Student', 'Senior', 'PWD'], true);
        $fare = $this->ltfrbFareForKm($data['bus_type'], $km, $isDiscounted);

        return response()->json([
            'success' => true,
            'data' => [
                'fare' => $fare,
                'km' => $km,
                'passenger_type' => $type,
                'distance_km_to_stop' => $stopDist,
                'full_route_distance_km' => $fullKm,
                'stop' => $selectedStop,
            ],
        ]);
    }

    /**
     * Full-route fare with concession discount (commuter app e-ticket flow).
     */
    public function fareCalculate(Request $request)
    {
        $data = $request->validate([
            'route_id' => ['required', 'integer', 'exists:routes,id'],
            'commuter_id' => ['nullable', 'integer', 'exists:commuters,id'],
            'passenger_type' => ['nullable', 'string', 'max:32'], // fallback only
            'bus_type' => ['nullable', 'in:regular,aircon'],
        ]);

        $route = Route::query()->findOrFail($data['route_id']);
        $busType = $data['bus_type'] ?? 'regular';
        if (! in_array($busType, ['regular', 'aircon'], true)) {
            $busType = 'regular';
        }

        $km = max((float) ($route->distance_km ?? 0), 0.001);

        $type = $this->resolvePassengerType($data);
        $discountPercent = in_array($type, ['Student', 'Senior', 'PWD'], true) ? 20 : 0;

        $base = $this->ltfrbFareForKm($busType, $km, false);
        $finalFare = $this->ltfrbFareForKm($busType, $km, $discountPercent > 0);
        $discountAmount = $this->roundToQuarter(max(0.0, $base - $finalFare));

        return response()->json([
            'success' => true,
            'data' => [
                'base_fare' => $base,
                'final_fare' => $finalFare,
                'discount_percent' => $discountPercent,
                'discount_amount' => $discountAmount,
                'passenger_type' => $type,
                'km' => $km,
            ],
        ]);
    }

    /**
     * Persist an e-ticket against today's trip so operator trip logs and driver boarding counts update.
     */
    public function bookTicket(Request $request)
    {
        $data = $request->validate([
            'route_id' => ['required', 'integer', 'exists:routes,id'],
            'fare' => ['required', 'numeric', 'min:0'],
            'public_ticket_id' => ['required', 'string', 'max:64'],
            'schedule_id' => ['nullable', 'integer', 'exists:schedules,id'],
            'commuter_id' => ['nullable', 'integer', 'exists:commuters,id'],
            'payment_method' => ['nullable', 'string', 'max:32'],
            // Alight target: either a stop index or destination.
            'alight_stop_index' => ['nullable', 'integer', 'min:0'],
            'alight_is_destination' => ['nullable', 'boolean'],
        ]);

        $schedule = null;
        if (! empty($data['schedule_id'])) {
            $schedule = Schedule::query()->find($data['schedule_id']);
            if (! $schedule || (int) $schedule->route_id !== (int) $data['route_id']) {
                return response()->json([
                    'success' => false,
                    'message' => 'This schedule does not match the selected route.',
                ], 422);
            }
            if ($this->scheduleDateYmd($schedule) !== $this->commuterLocalToday()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This schedule is not for today.',
                ], 422);
            }
            if (! in_array($schedule->status, ['scheduled', 'accepted', 'active'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'This trip is not open for ticketing.',
                ], 422);
            }
        } else {
            $schedule = $this->findTodaysBookableScheduleForRoute((int) $data['route_id']);
        }

        if (! $schedule) {
            return response()->json([
                'success' => false,
                'message' => 'No scheduled trip found for this route today. Your operator must add a schedule for this date in the operator panel.',
            ], 404);
        }

        $schedule->load(['tickets', 'bus']);
        $capacity = (int) ($schedule->bus?->capacity ?? 0);
        if ($capacity > 0) {
            $aboard = TicketBoarding::aboardCount($schedule->tickets, $capacity);
            if ($aboard >= $capacity) {
                return response()->json([
                    'success' => false,
                    'message' => 'This bus is full. Choose another trip.',
                ], 422);
            }
        }

        try {
            $beforeAboard = $capacity > 0 ? TicketBoarding::aboardCount($schedule->tickets, $capacity) : null;
            $method = strtolower(trim((string) ($data['payment_method'] ?? '')));
            if ($method === '') {
                $method = 'cash';
            }
            $isCash = $method === 'cash';
            $paymentStatus = $isCash ? 'unpaid' : 'pending';
            $paymentRef = $isCash ? null : ('PAY-' . strtoupper(Str::random(10)) . '-' . strtoupper(Str::random(6)));

            $ticket = Ticket::create([
                'public_ticket_id' => $data['public_ticket_id'],
                'schedule_id' => $schedule->id,
                'alight_stop_index' => ! empty($data['alight_is_destination']) ? null : ($data['alight_stop_index'] ?? null),
                'alight_is_destination' => ! empty($data['alight_is_destination']),
                'fare' => $data['fare'],
                'commuter_id' => $data['commuter_id'] ?? null,
                'payment_method' => $method,
                'payment_status' => $paymentStatus,
                'payment_ref' => $paymentRef,
                // QR is only issued once paid (for online methods); cash tickets do not get a prepaid QR.
                'qr_payload' => null,
            ]);

            // Capacity / overcrowding alert trigger (one-time per schedule when it becomes full).
            if ($capacity > 0) {
                $schedule->loadMissing(['tickets', 'bus']);
                $afterAboard = TicketBoarding::aboardCount($schedule->tickets, $capacity);
                if ($beforeAboard !== null && $beforeAboard < $capacity && $afterAboard >= $capacity) {
                    $this->notifyBusFull($schedule, $afterAboard, $capacity);
                }
            }
        } catch (\Illuminate\Database\QueryException $e) {
            $msg = strtolower($e->getMessage());
            if (str_contains($msg, 'unique') || $e->getCode() === '23000') {
                return response()->json([
                    'success' => false,
                    'message' => 'This ticket ID was already registered.',
                ], 409);
            }
            Log::error('bookTicket failed: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Could not save the ticket. Try again.',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $ticket->id,
                'public_ticket_id' => $ticket->public_ticket_id,
                'schedule_id' => $schedule->id,
                'payment_method' => $ticket->payment_method,
                'payment_status' => $ticket->payment_status,
                'payment_ref' => $ticket->payment_ref,
                'alight_stop_index' => $ticket->alight_stop_index,
                'alight_is_destination' => (bool) $ticket->alight_is_destination,
            ],
        ]);
    }

    private function notifyBusFull(Schedule $schedule, int $aboard, int $capacity): void
    {
        try {
            $operatorId = (int) ($schedule->user_id ?? 0);
            $driverId = (int) ($schedule->driver_id ?? 0);
            $busId = (int) ($schedule->bus_id ?? 0);

            $msg = "Bus is full ({$aboard}/{$capacity}). Booking should be blocked until passengers alight.";

            // Operator inbox (received notifications use sender_id = null)
            if ($operatorId > 0) {
                $exists = Notification::query()
                    ->where('type', 'capacity_alert')
                    ->where('schedule_id', $schedule->id)
                    ->where('recipient_id', $operatorId)
                    ->whereNull('sender_id')
                    ->exists();

                if (! $exists) {
                    Notification::create([
                        'type' => 'capacity_alert',
                        'message' => $msg,
                        'sender_id' => null,
                        'recipient_id' => $operatorId,
                        'driver_id' => $driverId > 0 ? $driverId : null,
                        'schedule_id' => $schedule->id,
                        'bus_id' => $busId > 0 ? $busId : null,
                        'is_read' => false,
                    ]);
                }
            }

            // Driver inbox (driver app fetches where sender_id is NOT null)
            if ($operatorId > 0 && $driverId > 0) {
                $exists = Notification::query()
                    ->where('type', 'capacity_alert')
                    ->where('schedule_id', $schedule->id)
                    ->where('driver_id', $driverId)
                    ->where('sender_id', $operatorId)
                    ->exists();

                if (! $exists) {
                    Notification::create([
                        'type' => 'capacity_alert',
                        'message' => $msg,
                        'sender_id' => $operatorId,
                        'recipient_id' => null,
                        'driver_id' => $driverId,
                        'schedule_id' => $schedule->id,
                        'bus_id' => $busId > 0 ? $busId : null,
                        'is_read' => false,
                    ]);
                }
            }
        } catch (\Throwable $e) {
            Log::warning('notifyBusFull failed: '.$e->getMessage());
        }
    }

    /**
     * Driver reached a stop/destination: mark matching tickets as alighted (passenger count drops).
     * Body: { schedule_id, stop_index?: int, is_destination?: bool }
     */
    public function driverArrived(Request $request, int $driverId)
    {
        $data = $request->validate([
            'schedule_id' => ['required', 'integer', 'exists:schedules,id'],
            'stop_index' => ['nullable', 'integer', 'min:0'],
            'is_destination' => ['nullable', 'boolean'],
        ]);

        $schedule = Schedule::query()->findOrFail((int) $data['schedule_id']);
        if ((int) $schedule->driver_id !== (int) $driverId) {
            return response()->json(['success' => false, 'message' => 'Schedule does not belong to this driver.'], 403);
        }

        $now = now();
        $isDest = ! empty($data['is_destination']);

        $q = Ticket::query()
            ->where('schedule_id', $schedule->id)
            ->whereNull('alighted_at');

        if ($isDest) {
            $q->where('alight_is_destination', true);
        } else {
            $stopIndex = (int) ($data['stop_index'] ?? -1);
            if ($stopIndex < 0) {
                return response()->json(['success' => false, 'message' => 'stop_index is required unless is_destination=true'], 422);
            }
            $q->where('alight_is_destination', false)
                ->where('alight_stop_index', $stopIndex);
        }

        $updated = $q->update(['alighted_at' => $now]);

        return response()->json(['success' => true, 'updated' => $updated]);
    }

    /**
     * Commuter reached their stop: frees a seat for driver/operator “aboard” counts.
     * All ticket revenue rows stay in the database for trip logs.
     */
    public function alight(Request $request)
    {
        $data = $request->validate([
            'public_ticket_id' => ['required', 'string', 'max:64'],
        ]);

        $ticket = Ticket::query()->where('public_ticket_id', $data['public_ticket_id'])->first();
        if (! $ticket) {
            return response()->json([
                'success' => false,
                'message' => 'Ticket not found.',
            ], 404);
        }

        $now = now();

        if ($ticket->commuter_id) {
            Ticket::query()
                ->where('schedule_id', $ticket->schedule_id)
                ->where('commuter_id', $ticket->commuter_id)
                ->whereNull('alighted_at')
                ->update(['alighted_at' => $now]);
        } else {
            if ($ticket->alighted_at === null) {
                $ticket->alighted_at = $now;
                $ticket->save();
            }
        }

        return response()->json(['success' => true]);
    }

    /**
     * Active trips for a route today (commuter app: pick a bus + see live position estimate).
     */
    public function liveBuses(Request $request)
    {
        $data = $request->validate([
            'route_id' => ['required', 'integer', 'exists:routes,id'],
            'terminal' => ['required', 'in:north,south'],
            'bus_type' => ['nullable', 'in:regular,aircon'],
        ]);

        $busType = $data['bus_type'] ?? 'regular';
        $route = Route::query()->findOrFail($data['route_id']);

        if (($route->bus_type ?? 'regular') !== $busType) {
            return response()->json(['success' => true, 'buses' => []]);
        }

        if (! $this->routeIsApprovedForTerminal((int) $route->id, $data['terminal'])) {
            return response()->json([
                'success' => false,
                'message' => 'This route is not available for the selected terminal.',
            ], 404);
        }

        $today = $this->commuterLocalToday();

        $schedules = Schedule::query()
            ->with(['bus', 'driver', 'user', 'tickets', 'route'])
            ->where('route_id', $route->id)
            ->whereDate('date', $today)
            ->whereIn('status', ['scheduled', 'accepted', 'active'])
            ->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END")
            ->orderBy('start_time')
            ->get();

        $buses = [];
        foreach ($schedules as $s) {
            $capacity = (int) ($s->bus?->capacity ?? 0);
            $aboard = TicketBoarding::aboardCount($s->tickets, $capacity);
            $isFull = $capacity > 0 && $aboard >= $capacity;
            $pos = $this->estimateBusPosition($s);

            $buses[] = [
                'schedule_id' => $s->id,
                'status' => $s->status,
                'bus_number' => $s->bus?->bus_number ?? '',
                'plate_number' => $s->bus?->plate_number ?? '',
                'bus_company' => $s->bus?->bus_company ?? '',
                'capacity' => $capacity,
                'aboard' => $aboard,
                'is_full' => $isFull,
                'driver_name' => $s->driver?->name ?? '',
                'operator_company' => $s->user?->company_name ?? '',
                'start_time' => $s->start_time ? $s->start_time->format('H:i') : null,
                'position' => $pos,
            ];
        }

        return response()->json([
            'success' => true,
            'buses' => $buses,
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Fare for traveling between two pathway stops (distance-proportional), with concession discount.
     */
    public function fareSegment(Request $request)
    {
        $data = $request->validate([
            'route_id' => ['required', 'integer', 'exists:routes,id'],
            'bus_type' => ['required', 'in:regular,aircon'],
            // allow -1 (terminal)
            'from_stop_index' => ['required', 'integer', 'min:-1'],
            'to_stop_index' => ['required', 'integer', 'min:0'],
            'approval_request_id' => ['nullable', 'integer', 'exists:route_approval_requests,id'],
            'commuter_id' => ['nullable', 'integer', 'exists:commuters,id'],
            'passenger_type' => ['nullable', 'string', 'max:32'], // fallback only
        ]);

        $fromCmp = max(0, (int) $data['from_stop_index']);
        if ($fromCmp >= (int) $data['to_stop_index']) {
            return response()->json([
                'success' => false,
                'message' => 'Alighting stop must be after your boarding stop.',
            ], 422);
        }

        $route = Route::query()->findOrFail($data['route_id']);
        $fullKm = max((float) ($route->distance_km ?? 0), 0.001);

        $pkg = null;
        if (! empty($data['approval_request_id'])) {
            $pkg = RouteApprovalRequest::query()
                ->where('status', 'approved')
                ->find($data['approval_request_id']);
        }
        if (! $pkg) {
            $pkg = RouteApprovalRequest::query()
                ->where('status', 'approved')
                ->orderByDesc('decided_at')
                ->get()
                ->first(function ($p) use ($data) {
                    return in_array((int) $data['route_id'], $p->route_ids ?? [], true);
                });
        }

        $distFrom = 0.0;
        $distTo = $fullKm;

        if ($pkg && is_array($pkg->stop_configuration)) {
            foreach ($pkg->stop_configuration as $block) {
                if ((int) ($block['route_id'] ?? 0) !== (int) $data['route_id']) {
                    continue;
                }
                $stops = $block['stops'] ?? [];
                $iFromRaw = (int) $data['from_stop_index'];
                $iFrom = $iFromRaw < 0 ? 0 : $iFromRaw;
                $iTo = $data['to_stop_index'];
                $stopCount = is_array($stops) ? count($stops) : 0;
                // Allow destination as "one past last stop index" => use full route distance.
                $toIsDestination = $stopCount > 0 && (int) $iTo === $stopCount;
                if (! isset($stops[$iFrom]) || (! $toIsDestination && ! isset($stops[$iTo]))) {
                    continue;
                }
                // If boarding at terminal (-1), start from 0 km (even if first stop isn't exactly at 0).
                $distFrom = $iFromRaw < 0
                    ? 0.0
                    : (float) ($stops[$iFrom]['distance_km_from_start'] ?? 0);
                $distTo = $toIsDestination
                    ? $fullKm
                    : (float) ($stops[$iTo]['distance_km_from_start'] ?? $fullKm);
                break;
            }
        }

        if ($distTo <= $distFrom) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid stop spacing for this route package.',
            ], 422);
        }

        $km = max(0.0, (float) ($distTo - $distFrom));
        $base = $this->ltfrbFareForKm($data['bus_type'], $km, false);

        $type = $this->resolvePassengerType($data);
        $discountPercent = in_array($type, ['Student', 'Senior', 'PWD'], true) ? 20 : 0;

        $finalFare = $this->ltfrbFareForKm($data['bus_type'], $km, $discountPercent > 0);
        $discountAmount = $this->roundToQuarter(max(0.0, $base - $finalFare));

        return response()->json([
            'success' => true,
            'data' => [
                'base_fare' => $base,
                'final_fare' => $finalFare,
                'discount_percent' => $discountPercent,
                'discount_amount' => $discountAmount,
                'passenger_type' => $type,
                'km' => $km,
                'distance_km_from' => $distFrom,
                'distance_km_to' => $distTo,
                'full_route_distance_km' => $fullKm,
            ],
        ]);
    }

    /**
     * LTFRB Add-on Method (Metro Manila PUB fare guide, effective Oct 3 2022).
     * Ordinary: first 5 km = 13.00, succeeding = +2.25/km
     * Aircon: first 5 km = 15.00, succeeding = +2.65/km
     * Concession: 20% off, then round to nearest 0.25
     */
    private function ltfrbFareForKm(string $busType, float $km, bool $discounted): float
    {
        $km = max(0.0, $km);

        $busType = strtolower($busType) === 'aircon' ? 'aircon' : 'regular';
        $first5 = $busType === 'aircon' ? 15.00 : 13.00;
        $perKm = $busType === 'aircon' ? 2.65 : 2.25;

        $fare = $km <= 5.0
            ? $first5
            : ($first5 + ($perKm * ($km - 5.0)));

        if ($discounted) {
            $fare *= 0.8;
        }

        return $this->roundToQuarter($fare);
    }

    private function roundToQuarter(float $amount): float
    {
        // "nearest 25 centavos"
        $v = round($amount * 4) / 4;
        return round($v, 2);
    }

    /**
     * Prefer commuter.passenger_type from DB (registration/profile) when commuter_id is provided.
     * Falls back to request passenger_type or Regular.
     */
    private function resolvePassengerType(array $data): string
    {
        $fromDb = null;
        if (! empty($data['commuter_id'])) {
            $c = Commuter::query()->find($data['commuter_id']);
            $fromDb = $c?->passenger_type;
        }

        $raw = (string) ($fromDb ?: ($data['passenger_type'] ?? 'Regular'));
        $raw = trim($raw);
        if ($raw === '') {
            $raw = 'Regular';
        }

        $u = strtoupper($raw);
        if ($u === 'PWD') {
            return 'PWD';
        }
        if (in_array($u, ['SENIOR', 'ELDER', 'ELDERLY'], true)) {
            return 'Senior';
        }
        if ($u === 'STUDENT') {
            return 'Student';
        }

        return 'Regular';
    }

    private function routeIsApprovedForTerminal(int $routeId, string $terminal): bool
    {
        $packages = RouteApprovalRequest::query()
            ->where('status', 'approved')
            ->where('terminal', $terminal)
            ->get();

        foreach ($packages as $pkg) {
            foreach ($pkg->stop_configuration ?? [] as $block) {
                if ((int) ($block['route_id'] ?? 0) === $routeId) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @return array{lng: float, lat: float}|null
     */
    private function estimateBusPosition(Schedule $schedule): ?array
    {
        // Prefer real driver GPS pings if we have them (driver app live tracking).
        if ($schedule->driver_id) {
            $since = now()->subMinutes(10);
            $q = DriverLocation::query()
                ->where('driver_id', $schedule->driver_id)
                ->where('recorded_at', '>=', $since)
                ->orderByDesc('recorded_at');

            // If driver is pinging with schedule_id, prioritize this specific trip.
            $loc = (clone $q)->where('schedule_id', $schedule->id)->first();
            if (! $loc) {
                $loc = $q->first();
            }

            if ($loc) {
                return ['lng' => (float) $loc->longitude, 'lat' => (float) $loc->latitude];
            }
        }

        $route = $schedule->route;
        if (! $route) {
            return null;
        }

        $coords = $this->lineStringCoordinates($route->geometry);
        if (! $coords || count($coords) < 2) {
            return null;
        }

        $n = count($coords);
        if ($schedule->status !== 'active' || ! $schedule->started_at) {
            return [
                'lng' => (float) $coords[0][0],
                'lat' => (float) $coords[0][1],
            ];
        }

        $elapsed = max(0, Carbon::now()->diffInSeconds(Carbon::parse($schedule->started_at)));
        $km = max(0.1, (float) ($route->distance_km ?? 5));
        $hours = $km / 20;
        $estimatedSeconds = max(600, (int) round($hours * 3600));
        $t = min(1.0, $elapsed / $estimatedSeconds);
        $idx = $t * ($n - 1);
        $i = (int) floor($idx);
        $f = $idx - $i;

        if ($i >= $n - 1) {
            return [
                'lng' => (float) $coords[$n - 1][0],
                'lat' => (float) $coords[$n - 1][1],
            ];
        }

        $a = $coords[$i];
        $b = $coords[$i + 1];

        return [
            'lng' => (float) $a[0] + $f * ((float) $b[0] - (float) $a[0]),
            'lat' => (float) $a[1] + $f * ((float) $b[1] - (float) $a[1]),
        ];
    }

    /**
     * @return list<list{0: float, 1: float}>|null
     */
    private function lineStringCoordinates(mixed $geometry): ?array
    {
        if ($geometry === null) {
            return null;
        }
        if (is_string($geometry)) {
            $geometry = json_decode($geometry, true);
        }
        if (! is_array($geometry)) {
            return null;
        }
        if (($geometry['type'] ?? null) === 'Feature' && isset($geometry['geometry'])) {
            $geometry = $geometry['geometry'];
        }
        if (($geometry['type'] ?? null) !== 'LineString' || ! isset($geometry['coordinates']) || ! is_array($geometry['coordinates'])) {
            return null;
        }

        $out = [];
        foreach ($geometry['coordinates'] as $c) {
            if (! is_array($c) || count($c) < 2) {
                continue;
            }
            $lng = (float) $c[0];
            $lat = (float) $c[1];
            if (abs($lng) <= 90 && abs($lat) > 90) {
                [$lng, $lat] = [$lat, $lng];
            }
            $out[] = [$lng, $lat];
        }

        return count($out) >= 2 ? $out : null;
    }

    /**
     * Calendar "today" in Asia/Manila so trips match the driver/operator workday.
     */
    private function commuterLocalToday(): string
    {
        return Carbon::now('Asia/Manila')->toDateString();
    }

    private function findTodaysBookableScheduleForRoute(int $routeId): ?Schedule
    {
        $today = $this->commuterLocalToday();

        return Schedule::query()
            ->where('route_id', $routeId)
            ->whereDate('date', $today)
            ->whereIn('status', ['scheduled', 'accepted', 'active'])
            ->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'accepted' THEN 1 WHEN 'scheduled' THEN 2 ELSE 3 END")
            ->orderBy('start_time')
            ->first();
    }

    private function scheduleDateYmd(Schedule $schedule): string
    {
        if ($schedule->date instanceof \Carbon\CarbonInterface) {
            return $schedule->date->format('Y-m-d');
        }

        return Carbon::parse((string) $schedule->date)->format('Y-m-d');
    }
}
