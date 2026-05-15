<?php

namespace App\Http\Controllers;

use App\Models\DriverLocation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DriverLocationController extends Controller
{
    /**
     * Operator web panel: latest ping per driver for live map (session auth).
     */
    public function latestForOperator(Request $request)
    {
        $operatorId = Auth::id();
        if (! $operatorId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $sinceMinutes = (int) ($request->query('since_minutes', 10));
        $sinceMinutes = max(1, min($sinceMinutes, 120));
        $since = now()->subMinutes($sinceMinutes);

        $latest = DriverLocation::query()
            ->whereHas('driver', fn ($q) => $q->where('user_id', $operatorId))
            ->where('recorded_at', '>=', $since)
            ->with([
                'driver:id,name,user_id',
                'schedule:id,driver_id,route_id,bus_id,status,leg_status',
                'schedule.route:id,name,start_location,end_location',
                'schedule.bus:id,bus_number,model',
            ])
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
