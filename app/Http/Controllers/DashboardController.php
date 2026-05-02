<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Bus;
use App\Models\Message;
use App\Models\Space;
use App\Models\TerminalSpace;
use App\Models\Schedule;
use App\Models\TerminalOccupancyHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use GetStream\StreamChat\Client as StreamChat;

class DashboardController extends Controller
{

    public function index()
    {
        $user = Auth::user();

        $query = Schedule::with(['bus', 'driver', 'route']);

        // Filter schedules by terminal for bus managers
        if ($user && $user->role === 'northBusManager') {
            $query->whereHas('bus', function ($q) {
                $q->where('terminal', 'north');
            });
        } elseif ($user && $user->role === 'southBusManager') {
            $query->whereHas('bus', function ($q) {
                $q->where('terminal', 'south');
            });
        }

        // Get only recent 10 schedules for dashboard
        $busSchedules = $query->orderBy('date', 'desc')->limit(10)->get();

        $drivers = User::where('role', 'driver')->get();

        $statuses = ['scheduled', 'active', 'completed', 'cancelled'];

        // Build stats based on terminal
        $busQuery = Bus::whereIn('status', ['available', 'in_service']);
        $scheduleQuery = Schedule::query();

        if ($user && $user->role === 'northBusManager') {
            $busQuery->where('terminal', 'north');
            $scheduleQuery->whereHas('bus', function ($q) {
                $q->where('terminal', 'north');
            });
        } elseif ($user && $user->role === 'southBusManager') {
            $busQuery->where('terminal', 'south');
            $scheduleQuery->whereHas('bus', function ($q) {
                $q->where('terminal', 'south');
            });
        }

        // Get terminal spaces (updated occupancy tracking)
        $spaceQuery = TerminalSpace::query();
        $available = $spaceQuery->where('is_occupied', false)->count();
        $total = $spaceQuery->count();

        // If terminal spaces don't exist, fallback to regular spaces
        if ($total === 0) {
            $available = Space::where('is_occupied', false)->count();
            $total = Space::count();
        }

        // Get unread messages count from Stream
        $unreadCount = 0;
        try {
            $streamClient = new StreamChat(
                env('STREAM_API_KEY'),
                env('STREAM_API_SECRET')
            );

            $channels = $streamClient->queryChannels(
                ['members' => ['$in' => [(string)$user->id]]],
                [],
                ['state' => true]
            );

            foreach ($channels['channels'] as $channel) {
                $unreadCount += $channel['channel']['read'][(string)$user->id]['unread_messages'] ?? 0;
            }
        } catch (\Exception $e) {
            $unreadCount = 0;
        }

        // Get schedule status breakdown for analytics
        $scheduleAnalytics = Schedule::query();

        if ($user && $user->role === 'northBusManager') {
            $scheduleAnalytics->whereHas('bus', function ($q) {
                $q->where('terminal', 'north');
            });
        } elseif ($user && $user->role === 'southBusManager') {
            $scheduleAnalytics->whereHas('bus', function ($q) {
                $q->where('terminal', 'south');
            });
        }

        $statusCounts = $scheduleAnalytics->groupBy('status')
            ->selectRaw('status, COUNT(*) as count')
            ->pluck('count', 'status');

        // Get bus utilization
        $totalBuses = Bus::query();
        $busInService = Bus::query()->whereIn('status', ['available', 'in_service']);

        if ($user && $user->role === 'northBusManager') {
            $totalBuses->where('terminal', 'north');
            $busInService->where('terminal', 'north');
        } elseif ($user && $user->role === 'southBusManager') {
            $totalBuses->where('terminal', 'south');
            $busInService->where('terminal', 'south');
        }

        $totalBusesCount = $totalBuses->count();
        $busUtilizationPercent = $totalBusesCount > 0
            ? round(($busInService->count() / $totalBusesCount) * 100, 1)
            : 0;

        // Get space utilization
        $spaceUtilizationPercent = $total > 0
            ? round((($total - $available) / $total) * 100, 1)
            : 0;

        $stats = [
            'active_busses' => $busQuery->count(),
            'available_spaces' => $available,
            'total_spaces' => $total,
            'total_schedules' => $scheduleQuery->count(),
            'new_messages' => $unreadCount,
        ];

        $analytics = [
            'status_counts' => $statusCounts->toArray(),
            'bus_utilization' => $busUtilizationPercent,
            'total_buses' => $totalBusesCount,
            'buses_in_service' => $busInService->count(),
            'space_utilization' => $spaceUtilizationPercent,
            'total_spaces' => $total,
            'occupied_spaces' => $total - $available,
            'available_spaces' => $available,
            'occupancy_by_hour' => $this->getOccupancyByHour($user),
        ];

        return view('operations.dashboard', compact('stats', 'busSchedules', 'drivers', 'statuses', 'analytics'));
    }

    /**
     * Get occupancy data grouped by hour of day
     * Returns the count of occupied spaces for each hour
     */
    private function getOccupancyByHour($user)
    {
        $query = TerminalOccupancyHistory::selectRaw('HOUR(time_occupied) as hour, COUNT(*) as occupancy_count')
            ->groupBy('hour')
            ->whereNotNull('time_occupied')
            ->orderBy('hour');

        $occupancyData = $query->get();

        // Create array for all 24 hours
        $hoursData = array_fill(0, 24, 0);
        foreach ($occupancyData as $data) {
            $hoursData[$data->hour] = $data->occupancy_count;
        }

        return $hoursData;
    }

    /**
     * Get available spaces count (for real-time updates)
     * This endpoint allows the dashboard to poll for updated space availability
     */
    public function getAvailableSpaces()
    {
        $spaceQuery = TerminalSpace::query();
        $available = $spaceQuery->where('is_occupied', false)->count();
        $total = $spaceQuery->count();

        // If terminal spaces don't exist, fallback to regular spaces
        if ($total === 0) {
            $available = Space::where('is_occupied', false)->count();
            $total = Space::count();
        }

        return response()->json([
            'available' => $available,
            'total' => $total,
        ]);
    }
}
