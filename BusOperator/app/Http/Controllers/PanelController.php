<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\Route;
use App\Models\Bus;
use App\Models\Driver;
use App\Models\Notification;
use App\Models\RouteApprovalRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class PanelController extends Controller
{
    public function liveTracking()
    {
        return view('panels.live-tracking');
    }

    public function operatorPanel()
    {
        $userId = Auth::id();
        
        // ✅ Log current user
        Log::info("Current user ID: " . $userId);

        // ✅ Get only the current user's data
        $recentSchedules = Schedule::with(['route', 'bus', 'driver'])
            ->where('user_id', $userId)
            ->orderBy('date', 'desc')
            ->orderBy('start_time', 'desc')
            ->paginate(10);

        $activeRoutes = Route::where('user_id', $userId)
            ->where('status', 'active')
            ->count();
            
        $activeBuses = Bus::where('user_id', $userId)
            ->where('status', 'available')
            ->count();
            
        $activeDrivers = Driver::where('user_id', $userId)
            ->where('status', 'active')
            ->count();

        $todaySchedules = Schedule::where('user_id', $userId)
            ->whereDate('date', today())
            ->count();
            
        $activeSchedules = Schedule::where('user_id', $userId)
            ->where('status', 'active')
            ->count();
            
        $completedSchedules = Schedule::where('user_id', $userId)
            ->whereDate('date', today())
            ->where('status', 'completed')
            ->count();
            
        $pendingSchedules = Schedule::where('user_id', $userId)
            ->whereDate('date', today())
            ->where('status', 'scheduled')
            ->count();

        // ✅ Count actual issues from schedules
        $issues = Schedule::where('user_id', $userId)
            ->whereDate('date', today())
            ->where('status', 'cancelled')
            ->count();

        // ✅ Calculate performance stats
        $totalTodaySchedules = Schedule::where('user_id', $userId)
            ->whereDate('date', today())
            ->count();
            
        $onTimeSchedules = Schedule::where('user_id', $userId)
            ->whereDate('date', today())
            ->where('status', 'completed')
            ->count();
            
        $delayedSchedules = Schedule::where('user_id', $userId)
            ->whereDate('date', today())
            ->where('status', 'active')
            ->where('start_time', '<', now()->format('H:i:s'))
            ->count();
            
        $cancelledSchedules = Schedule::where('user_id', $userId)
            ->whereDate('date', today())
            ->where('status', 'cancelled')
            ->count();

        $performanceStats = [
            'onTime' => $totalTodaySchedules > 0 ? round(($onTimeSchedules / $totalTodaySchedules) * 100) : 0,
            'delayed' => $totalTodaySchedules > 0 ? round(($delayedSchedules / $totalTodaySchedules) * 100) : 0,
            'cancelled' => $totalTodaySchedules > 0 ? round(($cancelledSchedules / $totalTodaySchedules) * 100) : 0
        ];

        // ✅ Debug log
        Log::info("Dashboard Stats", [
            'activeRoutes' => $activeRoutes,
            'activeBuses' => $activeBuses,
            'activeDrivers' => $activeDrivers,
            'todaySchedules' => $todaySchedules,
            'recentSchedulesCount' => $recentSchedules->count()
        ]);

        return view('panels.operator', compact(
            'activeRoutes',
            'activeBuses',
            'activeDrivers',
            'todaySchedules',
            'activeSchedules',
            'completedSchedules',
            'pendingSchedules',
            'issues',
            'recentSchedules',
            'performanceStats'
        ));
    }

    public function getOperatorStats()
    {
        $userId = Auth::id();
        
        return response()->json([
            'total_routes' => Route::where('user_id', $userId)->count(),
            'active_routes' => Route::where('user_id', $userId)->where('status', 'active')->count(),
            'total_buses' => Bus::where('user_id', $userId)->count(),
            'active_buses' => Bus::where('user_id', $userId)->where('status', 'available')->count(),
            'total_drivers' => Driver::where('user_id', $userId)->count(),
            'active_drivers' => Driver::where('user_id', $userId)->where('status', 'active')->count(),
            'todaySchedules' => Schedule::where('user_id', $userId)->whereDate('date', today())->count(),
            'activeSchedules' => Schedule::where('user_id', $userId)->where('status', 'active')->count(),
            'completedSchedules' => Schedule::where('user_id', $userId)->whereDate('date', today())->where('status', 'completed')->count(),
            'pendingSchedules' => Schedule::where('user_id', $userId)->whereDate('date', today())->where('status', 'scheduled')->count(),
        ]);
    }

    /**
     * Single poll for unread notification count + a sync fingerprint of operator-owned records.
     * Excludes high-churn ticket rows so Trip Logs can keep using its own JSON poll without full reloads.
     */
    public function operatorSync(): JsonResponse
    {
        $userId = Auth::id();
        if (! $userId) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $unread = Notification::query()
            ->where('recipient_id', $userId)
            ->whereNull('sender_id')
            ->where('is_read', false)
            ->count();

        $ts = static fn ($v) => $v ? (string) $v : '0';

        $parts = [
            'n_in' => $ts(Notification::query()->where('recipient_id', $userId)->max('created_at')),
            'n_out' => $ts(Notification::query()->where('sender_id', $userId)->max('created_at')),
            'sch' => $ts(Schedule::query()->where('user_id', $userId)->max('updated_at')),
            'rte' => $ts(Route::query()->where('user_id', $userId)->max('updated_at')),
            'bus' => $ts(Bus::query()->where('user_id', $userId)->max('updated_at')),
            'drv' => $ts(Driver::query()->where('user_id', $userId)->max('updated_at')),
            'apr' => $ts(RouteApprovalRequest::query()->where('operator_user_id', $userId)->max('updated_at')),
        ];

        $syncToken = md5(json_encode($parts));

        return response()->json([
            'success' => true,
            'unread_notifications' => $unread,
            'sync_token' => $syncToken,
        ]);
    }
}