<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\DriverLocation;
use App\Models\Schedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\View\View;

class DriverLocationController extends Controller
{
    /**
     * Operator web panel — Mapbox map + driver list.
     */
    public function index(): View
    {
        return view('panels.live-tracking');
    }

    /**
     * Driver app: post location pings (no auth — same pattern as other driver API routes).
     */
    public function store(Request $request, int $driverId): JsonResponse
    {
        $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'accuracy_m' => 'nullable|numeric|min:0|max:100000',
            'speed_mps' => 'nullable|numeric|min:0|max:200',
            'heading_deg' => 'nullable|numeric|min:0|max:360',
            'schedule_id' => 'nullable|integer|exists:schedules,id',
            'recorded_at' => 'nullable|date',
        ]);

        $driver = Driver::find($driverId);
        if (! $driver) {
            return response()->json(['success' => false, 'message' => 'Driver not found'], 404);
        }

        $recordedAt = $request->filled('recorded_at') ? $request->date('recorded_at') : null;

        $result = DriverLocation::recordPing(
            $driverId,
            $request->filled('schedule_id') ? (int) $request->input('schedule_id') : null,
            (float) $request->input('latitude'),
            (float) $request->input('longitude'),
            $request->filled('accuracy_m') ? (float) $request->input('accuracy_m') : null,
            $request->filled('speed_mps') ? (float) $request->input('speed_mps') : null,
            $request->filled('heading_deg') ? (float) $request->input('heading_deg') : null,
            $recordedAt,
            3
        );

        if (! empty($result['skipped'])) {
            return response()->json(['success' => true, 'skipped' => true]);
        }

        return response()->json([
            'success' => true,
            'location_id' => $result['location_id'] ?? null,
        ]);
    }

    /**
     * Operator web panel: latest known location per driver (session auth).
     */
    public function latestForOperator(Request $request): JsonResponse
    {
        $operatorId = Auth::id();
        if (! $operatorId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $sinceMinutes = (int) $request->query('since_minutes', 10);
        $sinceMinutes = max(1, min($sinceMinutes, 120));
        $since = now()->subMinutes($sinceMinutes);

        $fromPings = DriverLocation::query()
            ->whereHas('driver', fn ($q) => $q->where('user_id', $operatorId))
            ->where('recorded_at', '>=', $since)
            ->with([
                'driver:id,name,user_id',
                'schedule:id,driver_id,route_id,bus_id,status',
                'schedule.route:id,name,start_location,end_location',
                'schedule.bus:id,bus_number,model',
            ])
            ->orderByDesc('recorded_at')
            ->get()
            ->groupBy('driver_id')
            ->map(fn ($rows) => $rows->first());

        /** @var \Illuminate\Support\Collection<int|string, DriverLocation|array> $byDriver */
        $byDriver = $fromPings;

        // Fallback: live position on `schedules` (only if those columns exist on this database).
        if (Schema::hasColumn('schedules', 'current_lat') && Schema::hasColumn('schedules', 'current_lng')) {
            $fallback = Schedule::query()
                ->where('user_id', $operatorId)
                ->whereIn('status', ['accepted', 'active'])
                ->whereNotNull('current_lat')
                ->whereNotNull('current_lng')
                ->with([
                    'driver:id,name,user_id',
                    'route:id,name,start_location,end_location',
                    'bus:id,bus_number,model',
                ])
                ->get();

            foreach ($fallback as $sch) {
                if (! $sch->driver_id || $byDriver->has($sch->driver_id)) {
                    continue;
                }
                $byDriver->put($sch->driver_id, $this->scheduleSnapshotAsLocationPayload($sch));
            }
        }

        return response()->json([
            'success' => true,
            'since_minutes' => $sinceMinutes,
            'locations' => $byDriver->values(),
        ]);
    }

    /**
     * Shape matches `DriverLocation` JSON for the live-tracking map script.
     */
    private function scheduleSnapshotAsLocationPayload(Schedule $s): array
    {
        $recorded = $s->started_at ?? $s->date ?? now();
        if ($recorded instanceof \Carbon\CarbonInterface) {
            $recordedIso = $recorded->toIso8601String();
        } else {
            $recordedIso = now()->toIso8601String();
        }

        return [
            'id' => null,
            'driver_id' => (int) $s->driver_id,
            'schedule_id' => (int) $s->id,
            'latitude' => (float) $s->current_lat,
            'longitude' => (float) $s->current_lng,
            'accuracy_m' => null,
            'speed_mps' => null,
            'heading_deg' => null,
            'recorded_at' => $recordedIso,
            'driver' => $s->driver ? $s->driver->only(['id', 'name', 'user_id']) : null,
            'schedule' => [
                'id' => $s->id,
                'driver_id' => $s->driver_id,
                'route_id' => $s->route_id,
                'bus_id' => $s->bus_id,
                'status' => $s->status,
                'route' => $s->route ? $s->route->only(['id', 'name', 'start_location', 'end_location']) : null,
                'bus' => $s->bus ? $s->bus->only(['id', 'bus_number', 'model']) : null,
            ],
            'source' => 'schedule_snapshot',
        ];
    }
}
