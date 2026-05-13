<?php

namespace App\Http\Controllers;

use App\Models\BoardingRequest;
use App\Models\Route;
use App\Models\RouteApprovalRequest;
use App\Models\Schedule;
use App\Models\Ticket;
use App\Support\TicketBoarding;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class CommuterRoutesController extends Controller
{
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

                $routes[] = [
                    'approval_request_id' => $pkg->id,
                    'route_id' => $route->id,
                    'schedule_id' => $schedule?->id,
                    'name' => $route->name,
                    'code' => $route->code,
                    'bus_type' => $route->bus_type,
                    'geometry' => $geometry,
                    'distance_km' => (float) ($route->distance_km ?? 0),
                    'regular_price' => (float) ($route->regular_price ?? $route->route_fare ?? 0),
                    'aircon_price' => (float) ($route->aircon_price ?? $route->route_fare ?? 0),
                    'stops' => $this->withEndpointStop($this->withTerminalStop($block['stops'] ?? [], $terminal), $route),
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
     * Register commuter intent to board at a stop (no payment required).
     * Appears as a marker on the driver map so the driver knows someone is waiting.
     */
    public function requestBoarding(Request $request): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'schedule_id'        => ['required', 'integer', 'exists:schedules,id'],
            'route_id'           => ['nullable', 'integer'],
            'from_stop_index'    => ['nullable', 'integer', 'min:0'],
            'commuter_id'        => ['nullable', 'integer'],
            'commuter_name'      => ['nullable', 'string', 'max:255'],
            'commuter_email'     => ['nullable', 'email', 'max:255'],
            'terminal'           => ['nullable', 'string', 'max:16'],
            'approval_request_id'=> ['nullable', 'integer'],
        ]);

        $fromStopIndex = (int) ($data['from_stop_index'] ?? 0);
        $terminal      = $data['terminal'] ?? 'north';
        $routeId       = $data['route_id'] ?? null;

        $boardingLng  = null;
        $boardingLat  = null;
        $boardingName = null;

        $pkg = null;
        if (! empty($data['approval_request_id'])) {
            $pkg = RouteApprovalRequest::query()->where('status', 'approved')->find($data['approval_request_id']);
        }
        if (! $pkg && $routeId) {
            $pkg = RouteApprovalRequest::query()
                ->where('status', 'approved')
                ->where('terminal', $terminal)
                ->get()
                ->first(fn ($p) => in_array((int) $routeId, array_map('intval', (array) ($p->route_ids ?? [])), true));
        }

        if ($pkg && is_array($pkg->stop_configuration) && $routeId) {
            foreach ($pkg->stop_configuration as $block) {
                if ((int) ($block['route_id'] ?? 0) === (int) $routeId) {
                    $stops = $this->withTerminalStop($block['stops'] ?? [], $pkg->terminal ?? $terminal);
                    $stop  = $stops[$fromStopIndex] ?? null;
                    if ($stop) {
                        $boardingLng  = (float) ($stop['lng'] ?? 0);
                        $boardingLat  = (float) ($stop['lat'] ?? 0);
                        $boardingName = $stop['name'] ?? null;
                    }
                    break;
                }
            }
        }

        if ($boardingLng === null) {
            $info = self::TERMINAL_STOPS[strtolower($terminal)] ?? null;
            if ($info) {
                $boardingLng  = $info['lng'];
                $boardingLat  = $info['lat'];
                $boardingName = $info['name'];
            }
        }

        // Cancel any pre-existing waiting requests for this commuter+schedule
        // so stop changes never leave orphaned markers on the driver map.
        $commuterIdentifier = isset($data['commuter_id']) && (int) $data['commuter_id'] > 0
            ? (int) $data['commuter_id'] : null;
        $commuterEmail      = ! empty($data['commuter_email']) ? $data['commuter_email'] : null;
        $commuterName       = ! empty($data['commuter_name']) ? $data['commuter_name'] : null;

        $cancelBase = BoardingRequest::query()
            ->where('schedule_id', $data['schedule_id'])
            ->where('status', 'waiting');

        if ($commuterIdentifier !== null) {
            (clone $cancelBase)->where('commuter_id', $commuterIdentifier)->update(['status' => 'cancelled']);
        } elseif ($commuterEmail !== null) {
            (clone $cancelBase)->where('commuter_email', $commuterEmail)->update(['status' => 'cancelled']);
        } elseif ($commuterName !== null) {
            (clone $cancelBase)->where('commuter_name', $commuterName)->update(['status' => 'cancelled']);
        }

        $req = BoardingRequest::create([
            'schedule_id'       => $data['schedule_id'],
            'route_id'          => $routeId,
            'from_stop_index'   => $fromStopIndex,
            'boarding_lng'      => $boardingLng,
            'boarding_lat'      => $boardingLat,
            'boarding_stop_name'=> $boardingName,
            'commuter_id'       => $data['commuter_id'] ?? null,
            'commuter_name'     => $data['commuter_name'] ?? null,
            'commuter_email'    => $data['commuter_email'] ?? null,
            'status'            => 'waiting',
        ]);

        return response()->json([
            'success'            => true,
            'id'                 => $req->id,
            'boarding_stop_name' => $boardingName,
        ]);
    }

    /**
     * Cancel a waiting boarding request (commuter changed their mind).
     */
    public function cancelBoardingRequest(int $id): \Illuminate\Http\JsonResponse
    {
        $req = BoardingRequest::query()->find($id);
        if (! $req) {
            return response()->json(['success' => false, 'message' => 'Request not found.'], 404);
        }
        $req->status = 'cancelled';
        $req->save();

        return response()->json(['success' => true]);
    }

    /**
     * Cancel ALL waiting boarding requests for a commuter (called on app init to clear stale sessions).
     */
    public function cancelMyBoardingRequests(Request $request): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'commuter_id'    => ['nullable', 'integer'],
            'commuter_email' => ['nullable', 'email', 'max:255'],
            'commuter_name'  => ['nullable', 'string', 'max:255'],
        ]);

        $commuterIdentifier = isset($data['commuter_id']) && (int) $data['commuter_id'] > 0
            ? (int) $data['commuter_id'] : null;
        $commuterEmail = ! empty($data['commuter_email']) ? $data['commuter_email'] : null;
        $commuterName  = ! empty($data['commuter_name'])  ? $data['commuter_name']  : null;

        if ($commuterIdentifier === null && $commuterEmail === null && $commuterName === null) {
            return response()->json(['success' => false, 'message' => 'No commuter identity provided.'], 422);
        }

        $q = BoardingRequest::query()->where('status', 'waiting');
        if ($commuterIdentifier !== null) {
            $q->where('commuter_id', $commuterIdentifier);
        } elseif ($commuterEmail !== null) {
            $q->where('commuter_email', $commuterEmail);
        } else {
            $q->where('commuter_name', $commuterName);
        }

        $cancelled = $q->update(['status' => 'cancelled']);

        return response()->json(['success' => true, 'cancelled' => $cancelled]);
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
        $fullFareRegular = (float) ($route->regular_price ?? $route->route_fare ?? 0);
        $fullFareAircon = (float) ($route->aircon_price ?? $route->route_fare ?? 0);
        $fullFare = $data['bus_type'] === 'aircon' ? $fullFareAircon : $fullFareRegular;

        $stopDist = $fullKm;
        $selectedStop = null;

        if ($pkg && is_array($pkg->stop_configuration)) {
            foreach ($pkg->stop_configuration as $block) {
                if ((int) ($block['route_id'] ?? 0) !== (int) $data['route_id']) {
                    continue;
                }
                $stops = $this->withEndpointStop($this->withTerminalStop($block['stops'] ?? [], $pkg->terminal ?? ''), $route);
                $idx = $data['stop_index'];
                if (! isset($stops[$idx])) {
                    continue;
                }
                $selectedStop = $stops[$idx];
                $stopDist = (float) ($selectedStop['distance_km_from_start'] ?? $fullKm);
                break;
            }
        }

        $ratio = min(1, max(0, $stopDist / $fullKm));
        $fare = round($fullFare * $ratio, 2);

        return response()->json([
            'success' => true,
            'data' => [
                'fare' => $fare,
                'ratio' => $ratio,
                'distance_km_to_stop' => $stopDist,
                'full_route_distance_km' => $fullKm,
                'full_route_fare' => $fullFare,
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
            'passenger_type' => ['nullable', 'string', 'max:32'],
            'bus_type' => ['nullable', 'in:regular,aircon'],
        ]);

        $route = Route::query()->findOrFail($data['route_id']);
        $busType = $data['bus_type'] ?? 'regular';
        if (! in_array($busType, ['regular', 'aircon'], true)) {
            $busType = 'regular';
        }

        $base = $busType === 'aircon'
            ? (float) ($route->aircon_price ?? $route->regular_price ?? $route->route_fare ?? 0)
            : (float) ($route->regular_price ?? $route->route_fare ?? 0);

        $type = ucfirst(strtolower(trim($data['passenger_type'] ?? 'Regular')));
        if ($type === 'Pwd') {
            $type = 'PWD';
        }

        $discountPercent = 0;
        if (in_array($type, ['Student', 'Senior', 'PWD'], true)) {
            $discountPercent = 20;
        }

        $discountAmount = round($base * ($discountPercent / 100), 2);
        $finalFare = round(max(0, $base - $discountAmount), 2);

        return response()->json([
            'success' => true,
            'data' => [
                'base_fare' => $base,
                'final_fare' => $finalFare,
                'discount_percent' => $discountPercent,
                'discount_amount' => $discountAmount,
                'passenger_type' => $type,
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
            'from_stop_index' => ['nullable', 'integer', 'min:0'],
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
            if (! in_array($schedule->status, ['active', 'accepted'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'The driver has not accepted this trip yet.',
                ], 422);
            }
        } else {
            $schedule = $this->findTodaysBookableScheduleForRoute((int) $data['route_id']);
        }

        if (! $schedule) {
            return response()->json([
                'success' => false,
                'message' => 'No driver is currently active on this route. Please wait for the driver to start the trip.',
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
            $ticket = Ticket::create([
                'public_ticket_id' => $data['public_ticket_id'],
                'schedule_id' => $schedule->id,
                'fare' => $data['fare'],
                'commuter_id' => $data['commuter_id'] ?? null,
                'qr_payload' => ! empty($data['payment_method'])
                    ? json_encode(['payment_method' => $data['payment_method']])
                    : null,
                'payment_method' => $data['payment_method'] ?? null,
                'payment_status' => 'pending',
                'from_stop_index' => $data['from_stop_index'] ?? null,
            ]);
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

        // Mark any pending boarding requests for this commuter/schedule as boarded
        if (! empty($data['commuter_id'])) {
            BoardingRequest::query()
                ->where('schedule_id', $schedule->id)
                ->where('commuter_id', $data['commuter_id'])
                ->where('status', 'waiting')
                ->update(['status' => 'boarded']);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $ticket->id,
                'public_ticket_id' => $ticket->public_ticket_id,
                'schedule_id' => $schedule->id,
            ],
        ]);
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
        $yesterday = Carbon::now('Asia/Manila')->subDay()->toDateString();
        $now = Carbon::now('Asia/Manila');

        $schedules = Schedule::query()
            ->with(['bus', 'driver', 'user', 'tickets', 'route'])
            ->where('route_id', $route->id)
            ->whereIn('date', [$today, $yesterday])
            ->whereIn('status', ['accepted', 'active'])
            ->orderBy('start_time')
            ->get()
            ->filter(function (Schedule $s) use ($now) {
                [, $windowEnd] = $s->windowBounds();
                return $windowEnd->addHour()->gt($now);
            })
            ->values();

        $buses = [];
        foreach ($schedules as $s) {
            $isReturnTrip = ($s->trip_leg ?? 1) % 2 === 0;
            $capacity = (int) ($s->bus?->capacity ?? 0);
            $aboard = TicketBoarding::aboardCount($s->tickets, $capacity);
            $isFull = $capacity > 0 && $aboard >= $capacity;
            $pos = $this->estimateBusPosition($s);

            $buses[] = [
                'schedule_id' => $s->id,
                'status' => $isReturnTrip ? 'active' : $s->status,
                'is_return_trip' => $isReturnTrip,
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
            'from_stop_index' => ['required', 'integer', 'min:0'],
            'to_stop_index' => ['required', 'integer', 'min:0'],
            'approval_request_id' => ['nullable', 'integer', 'exists:route_approval_requests,id'],
            'passenger_type' => ['nullable', 'string', 'max:32'],
        ]);

        if ($data['from_stop_index'] >= $data['to_stop_index']) {
            return response()->json([
                'success' => false,
                'message' => 'Alighting stop must be after your boarding stop.',
            ], 422);
        }

        $route = Route::query()->findOrFail($data['route_id']);
        $fullKm = max((float) ($route->distance_km ?? 0), 0.001);
        $fullFareRegular = (float) ($route->regular_price ?? $route->route_fare ?? 0);
        $fullFareAircon = (float) ($route->aircon_price ?? $route->route_fare ?? 0);
        $fullFare = $data['bus_type'] === 'aircon' ? $fullFareAircon : $fullFareRegular;

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
                $stops = $this->withEndpointStop($this->withTerminalStop($block['stops'] ?? [], $pkg->terminal ?? ''), $route);
                $iFrom = $data['from_stop_index'];
                $iTo = $data['to_stop_index'];
                if (! isset($stops[$iFrom], $stops[$iTo])) {
                    continue;
                }
                $distFrom = (float) ($stops[$iFrom]['distance_km_from_start'] ?? 0);
                $distTo = (float) ($stops[$iTo]['distance_km_from_start'] ?? $fullKm);
                break;
            }
        }

        if ($distTo <= $distFrom) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid stop spacing for this route package.',
            ], 422);
        }

        $ratio = min(1, max(0, ($distTo - $distFrom) / $fullKm));
        $base = round($fullFare * $ratio, 2);

        $type = ucfirst(strtolower(trim($data['passenger_type'] ?? 'Regular')));
        if ($type === 'Pwd') {
            $type = 'PWD';
        }

        $discountPercent = 0;
        if (in_array($type, ['Student', 'Senior', 'PWD'], true)) {
            $discountPercent = 20;
        }

        $discountAmount = round($base * ($discountPercent / 100), 2);
        $finalFare = round(max(0, $base - $discountAmount), 2);

        return response()->json([
            'success' => true,
            'data' => [
                'base_fare' => $base,
                'final_fare' => $finalFare,
                'discount_percent' => $discountPercent,
                'discount_amount' => $discountAmount,
                'passenger_type' => $type,
                'ratio' => $ratio,
                'distance_km_from' => $distFrom,
                'distance_km_to' => $distTo,
                'full_route_distance_km' => $fullKm,
            ],
        ]);
    }

    private const TERMINAL_STOPS = [
        'north' => ['name' => 'Cebu North Bus Terminal', 'lng' => 123.920994, 'lat' => 10.311008],
        'south' => ['name' => 'Cebu South Bus Terminal', 'lng' => 123.893356, 'lat' => 10.298361],
    ];

    /**
     * Ensures stop index 0 is always the originating terminal.
     * Only prepends when the first stop is not already at the terminal (distance > 0).
     */
    private function withTerminalStop(array $stops, string $terminal): array
    {
        $info = self::TERMINAL_STOPS[strtolower($terminal)] ?? null;
        if (! $info) {
            return $stops;
        }
        $firstDist = (float) ($stops[0]['distance_km_from_start'] ?? PHP_INT_MAX);
        if ($firstDist < 0.01) {
            return $stops; // first stop is already at (or very near) the terminal
        }
        array_unshift($stops, [
            'name'                   => $info['name'],
            'lng'                    => $info['lng'],
            'lat'                    => $info['lat'],
            'distance_km_from_start' => 0.0,
            'eta_minutes'            => 0,
        ]);
        return $stops;
    }

    /**
     * Ensures the route endpoint is always the last stop.
     * Appends it automatically so commuters always see the final destination.
     */
    private function withEndpointStop(array $stops, Route $route): array
    {
        $fullKm = (float) ($route->distance_km ?? 0);
        $coords = $this->lineStringCoordinates($route->geometry);
        if (! $coords) {
            return $stops;
        }
        $lastCoord = $coords[count($coords) - 1];

        // Check if the last stop is already at (or very near) the endpoint
        if (! empty($stops)) {
            $last = end($stops);
            $dx = (float) ($last['lng'] ?? 0) - $lastCoord[0];
            $dy = (float) ($last['lat'] ?? 0) - $lastCoord[1];
            if (sqrt($dx * $dx + $dy * $dy) < 0.001) {
                return $stops; // already there
            }
        }

        $endName = $route->end_location ?? null;
        if (! $endName && $route->name) {
            $parts = preg_split('/ to /i', $route->name, 2);
            if (count($parts) === 2) {
                $endName = trim($parts[1]);
            }
        }
        $endName = $endName ?: 'Destination';

        $avgSpeed = 25;
        $etaMin = $fullKm > 0 ? (int) round(($fullKm / $avgSpeed) * 60) : 0;

        $stops[] = [
            'name'                   => $endName,
            'lng'                    => $lastCoord[0],
            'lat'                    => $lastCoord[1],
            'distance_km_from_start' => $fullKm,
            'eta_minutes'            => $etaMin,
        ];

        return $stops;
    }

    private function routeIsApprovedForTerminal(int $routeId, string $terminal): bool
    {
        $packages = RouteApprovalRequest::query()
            ->where('status', 'approved')
            ->where('terminal', $terminal)
            ->get();

        foreach ($packages as $pkg) {
            foreach ((array) ($pkg->route_ids ?? []) as $id) {
                if ((int) $id === $routeId) {
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
        $route = $schedule->route;
        if (! $route) {
            return null;
        }

        // Always prefer the driver's real GPS position (works for both outbound and return trips)
        if ($schedule->current_lat !== null && $schedule->current_lng !== null) {
            return [
                'lng' => (float) $schedule->current_lng,
                'lat' => (float) $schedule->current_lat,
            ];
        }

        $isReturnTrip = ($schedule->trip_leg ?? 1) % 2 === 0;

        $coords = $this->lineStringCoordinates($route->geometry);
        if (! $coords || count($coords) < 2) {
            return null;
        }

        $n = count($coords);

        // Return trip with no real GPS: place at the terminal end (start of return direction)
        if ($isReturnTrip) {
            return [
                'lng' => (float) $coords[$n - 1][0],
                'lat' => (float) $coords[$n - 1][1],
            ];
        }

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
        $yesterday = Carbon::now('Asia/Manila')->subDay()->toDateString();
        $now = Carbon::now('Asia/Manila');

        return Schedule::query()
            ->where('route_id', $routeId)
            ->whereIn('date', [$today, $yesterday])
            ->whereIn('status', ['active', 'accepted'])
            ->orderBy('start_time')
            ->get()
            ->first(function (Schedule $s) use ($now) {
                [, $windowEnd] = $s->windowBounds();
                return $windowEnd->addHour()->gt($now);
            });
    }

    private function scheduleDateYmd(Schedule $schedule): string
    {
        if ($schedule->date instanceof \Carbon\CarbonInterface) {
            return $schedule->date->format('Y-m-d');
        }

        return Carbon::parse((string) $schedule->date)->format('Y-m-d');
    }

    /**
     * Mark a ticket as paid after e-wallet or card payment succeeds on the commuter app.
     */
    public function markPaid(Request $request, string $publicTicketId): \Illuminate\Http\JsonResponse
    {
        $ticket = Ticket::query()->where('public_ticket_id', $publicTicketId)->first();
        if (! $ticket) {
            return response()->json(['success' => false, 'message' => 'Ticket not found.'], 404);
        }

        $ticket->payment_status = 'paid';
        if ($request->filled('payment_method')) {
            $ticket->payment_method = $request->input('payment_method');
        }
        $ticket->save();

        return response()->json(['success' => true]);
    }

    /**
     * Passenger manifest for the driver: who has booked/paid for this schedule.
     */
    public function manifest(int $scheduleId): \Illuminate\Http\JsonResponse
    {
        $schedule = Schedule::query()->with(['tickets.commuter'])->find($scheduleId);
        if (! $schedule) {
            return response()->json(['success' => false, 'message' => 'Schedule not found.'], 404);
        }

        // Build a stop lookup (index → stop) from the approved route package
        $stopsLookup = [];
        $pkg = RouteApprovalRequest::query()
            ->where('status', 'approved')
            ->get()
            ->first(function ($p) use ($schedule) {
                return in_array((int) $schedule->route_id, array_map('intval', (array) ($p->route_ids ?? [])), true);
            });

        if ($pkg && is_array($pkg->stop_configuration)) {
            foreach ($pkg->stop_configuration as $block) {
                if ((int) ($block['route_id'] ?? 0) === (int) $schedule->route_id) {
                    $manifestRoute = Route::query()->find($schedule->route_id);
                    $rawStops = $this->withTerminalStop($block['stops'] ?? [], $pkg->terminal ?? '');
                    $stops = $manifestRoute ? $this->withEndpointStop($rawStops, $manifestRoute) : $rawStops;
                    foreach ($stops as $i => $stop) {
                        $stopsLookup[$i] = $stop;
                    }
                    break;
                }
            }
        }

        $passengers = $schedule->tickets->map(function (Ticket $t) use ($stopsLookup) {
            $commuter = $t->commuter;
            $name = $commuter
                ? trim(implode(' ', array_filter([
                    $commuter->first_name ?? null,
                    $commuter->last_name ?? null,
                ]))) ?: $commuter->name ?? 'Guest'
                : 'Guest';

            $boardingStop = $t->from_stop_index !== null ? ($stopsLookup[(int) $t->from_stop_index] ?? null) : null;

            return [
                'ticket_id' => $t->public_ticket_id,
                'commuter_name' => $name,
                'fare' => (float) $t->fare,
                'payment_method' => $t->payment_method,
                'payment_status' => $t->payment_status ?? 'pending',
                'boarded_at' => $t->created_at?->toIso8601String(),
                'alighted' => $t->alighted_at !== null,
                'from_stop_index' => $t->from_stop_index,
                'boarding_lng' => $boardingStop ? (float) ($boardingStop['lng'] ?? 0) : null,
                'boarding_lat' => $boardingStop ? (float) ($boardingStop['lat'] ?? 0) : null,
                'boarding_stop_name' => $boardingStop['name'] ?? null,
            ];
        })->values();

        // Include waiting boarding requests (commuters flagged at stops, not yet paid).
        // Exclude requests older than 4 hours — those are stale sessions that were never cleaned up.
        // Deduplicate by newest: commuter_id → email → name → per-record fallback.
        $boardingReqs = BoardingRequest::query()
            ->where('schedule_id', $scheduleId)
            ->where('status', 'waiting')
            ->where('created_at', '>=', now()->subHours(4))
            ->orderByDesc('id')
            ->get()
            ->unique(function (BoardingRequest $r) {
                if ($r->commuter_id !== null && (int) $r->commuter_id > 0) {
                    return 'id:' . $r->commuter_id;
                }
                if (! empty($r->commuter_email)) {
                    return 'email:' . $r->commuter_email;
                }
                if (! empty($r->commuter_name)) {
                    return 'name:' . $r->commuter_name;
                }
                return 'anon:' . $r->id;
            })
            ->values();

        $pendingPassengers = $boardingReqs->map(function (BoardingRequest $r) {
            return [
                'ticket_id'          => 'REQ-' . $r->id,
                'commuter_name'      => $r->commuter_name ?? 'Waiting Passenger',
                'commuter_email'     => $r->commuter_email,
                'fare'               => null,
                'payment_method'     => null,
                'payment_status'     => 'pending_boarding',
                'boarded_at'         => $r->created_at?->toIso8601String(),
                'alighted'           => false,
                'from_stop_index'    => $r->from_stop_index,
                'boarding_lng'       => $r->boarding_lng !== null ? (float) $r->boarding_lng : null,
                'boarding_lat'       => $r->boarding_lat !== null ? (float) $r->boarding_lat : null,
                'boarding_stop_name' => $r->boarding_stop_name,
                'is_boarding_request'=> true,
            ];
        })->values();

        $allPassengers = $passengers->concat($pendingPassengers);

        return response()->json([
            'success'    => true,
            'schedule_id'=> $scheduleId,
            'passengers' => $allPassengers,
            'total'      => $allPassengers->count(),
            'paid'       => $passengers->where('payment_status', 'paid')->count(),
            'on_board'   => $passengers->where('alighted', false)->count(),
        ]);
    }
}
