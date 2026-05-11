<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Bus;
use App\Models\Space;
use App\Models\TerminalSpace;
use App\Models\NorthTerminalSpace;
use App\Models\Schedule;
use App\Models\TerminalOccupancyHistory;
use App\Models\NorthTerminalOccupancyHistory;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
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

        // Get terminal spaces ΓÇö guard missing tables (migrations not run on shared DB)
        $spaceStats = $this->resolveSpaceStats($user);
        $available = $spaceStats['available'];
        $total = $spaceStats['total'];

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
     * Space counts for dashboard / polling ΓÇö avoids 500 when Terminal Manager migrations
     * were not applied to the shared MySQL database (e.g. missing north_terminal_spaces).
     *
     * @return array{available: int, total: int}
     */
    private function resolveSpaceStats($user): array
    {
        $defaults = ['available' => 0, 'total' => 0];
        if (! $user) {
            return $defaults;
        }

        $isNorth = $user->role === 'northBusManager' || $user->terminal === 'north';
        $isSouth = $user->role === 'southBusManager' || $user->terminal === 'south';

        try {
            if ($isNorth && Schema::hasTable('north_terminal_spaces')) {
                return [
                    'available' => NorthTerminalSpace::where('is_occupied', false)->count(),
                    'total' => NorthTerminalSpace::count(),
                ];
            }
            if ($isSouth && Schema::hasTable('terminal_spaces')) {
                return [
                    'available' => TerminalSpace::where('is_occupied', false)->count(),
                    'total' => TerminalSpace::count(),
                ];
            }
            if (Schema::hasTable('spaces')) {
                return [
                    'available' => Space::where('is_occupied', false)->count(),
                    'total' => Space::count(),
                ];
            }
        } catch (\Throwable $e) {
            return $defaults;
        }

        return $defaults;
    }

    /**
     * Get occupancy data grouped by hour of day
     * Returns the count of occupied spaces for each hour
     */
    private function getOccupancyByHour($user)
    {
        $useNorth = $user && ($user->role === 'northBusManager' || $user->terminal === 'north');
        $northTable = 'north_terminal_occupancy_history';
        $southTable = 'terminal_occupancy_history';

        if ($useNorth && ! Schema::hasTable($northTable)) {
            return array_fill(0, 24, 0);
        }
        if (! $useNorth && ! Schema::hasTable($southTable)) {
            return array_fill(0, 24, 0);
        }

        // Use appropriate history table based on terminal (MySQL HOUR)
        if ($useNorth) {
            $query = NorthTerminalOccupancyHistory::selectRaw('HOUR(time_occupied) as hour, COUNT(*) as occupancy_count')
                ->groupBy('hour')
                ->whereNotNull('time_occupied')
                ->orderBy('hour');
        } else {
            $query = TerminalOccupancyHistory::selectRaw('HOUR(time_occupied) as hour, COUNT(*) as occupancy_count')
                ->groupBy('hour')
                ->whereNotNull('time_occupied')
                ->orderBy('hour');
        }

        try {
            $occupancyData = $query->get();
        } catch (\Throwable $e) {
            return array_fill(0, 24, 0);
        }

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
        $user = Auth::user();
        $spaceStats = $this->resolveSpaceStats($user);
        $available = $spaceStats['available'];
        $total = $spaceStats['total'];

        return response()->json([
            'available' => $available,
            'total' => $total,
        ]);
    }
}
