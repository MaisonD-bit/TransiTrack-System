<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\DriverLocation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DriverLocationController extends Controller
{
    /**
     * Driver app: post location pings (no web auth).
     */
    public function store(Request $request, int $driverId)
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
        if (!$driver) {
            return response()->json(['success' => false, 'message' => 'Driver not found'], 404);
        }

        // Soft rate-limit: avoid inserting more than 1 ping per 3 seconds per driver.
        $last = DriverLocation::query()
            ->where('driver_id', $driverId)
            ->orderByDesc('recorded_at')
            ->first();

        $now = now();
        if ($last && $last->recorded_at && $last->recorded_at->diffInSeconds($now) < 3) {
            return response()->json(['success' => true, 'skipped' => true]);
        }

        $loc = DriverLocation::create([
            'driver_id' => $driverId,
            'schedule_id' => $request->input('schedule_id'),
            'latitude' => (float) $request->input('latitude'),
            'longitude' => (float) $request->input('longitude'),
            'accuracy_m' => $request->filled('accuracy_m') ? (float) $request->input('accuracy_m') : null,
            'speed_mps' => $request->filled('speed_mps') ? (float) $request->input('speed_mps') : null,
            'heading_deg' => $request->filled('heading_deg') ? (float) $request->input('heading_deg') : null,
            'recorded_at' => $request->filled('recorded_at') ? $request->date('recorded_at') : $now,
        ]);

        return response()->json(['success' => true, 'location_id' => $loc->id]);
    }

    /**
     * Operator web panel: latest known location per driver (web auth).
     */
    public function latestForOperator(Request $request)
    {
        $operatorId = Auth::id();
        if (!$operatorId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $sinceMinutes = (int) ($request->query('since_minutes', 10));
        $sinceMinutes = max(1, min($sinceMinutes, 120));
        $since = now()->subMinutes($sinceMinutes);

        $latest = DriverLocation::query()
            ->whereHas('driver', fn ($q) => $q->where('user_id', $operatorId))
            ->where('recorded_at', '>=', $since)
            ->with(['driver:id,name,user_id', 'schedule:id,driver_id,route_id,bus_id,status', 'schedule.route:id,name,start_location,end_location', 'schedule.bus:id,bus_number,model'])
            ->orderByDesc('recorded_at')
            ->get()
            ->groupBy('driver_id')
            ->map(fn ($rows) => $rows->first())
            ->values();

        return response()->json([
            'success' => true,
            'since_minutes' => $sinceMinutes,
            'locations' => $latest,
        ]);
    }
}

