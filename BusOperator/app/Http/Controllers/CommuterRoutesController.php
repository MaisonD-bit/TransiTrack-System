<?php

namespace App\Http\Controllers;

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
                    'stops' => $block['stops'] ?? [],
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
            $ticket = Ticket::create([
                'public_ticket_id' => $data['public_ticket_id'],
                'schedule_id' => $schedule->id,
                'fare' => $data['fare'],
                'commuter_id' => $data['commuter_id'] ?? null,
                'qr_payload' => ! empty($data['payment_method'])
                    ? json_encode(['payment_method' => $data['payment_method']])
                    : null,
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
                $stops = $block['stops'] ?? [];
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
