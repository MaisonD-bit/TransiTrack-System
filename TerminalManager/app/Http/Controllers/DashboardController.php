<?php

namespace App\Http\Controllers;

use App\Models\Bus;
use App\Models\NorthTerminalOccupancyHistory;
use App\Models\NorthTerminalSpace;
use App\Models\Schedule;
use App\Models\Space;
use App\Models\TerminalOccupancyHistory;
use App\Models\TerminalSpace;
use App\Support\ManagerTerminalScope;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    use ManagerTerminalScope;

    public function index()
    {
        $user = Auth::user();

        $scheduleQuery = Schedule::with(['bus', 'driver', 'route']);
        $this->scopeSchedulesByTerminal($scheduleQuery);
        $busSchedules = (clone $scheduleQuery)->orderBy('date', 'desc')->limit(10)->get();

        $statuses = ['scheduled', 'active', 'completed', 'cancelled'];

        $busQuery = Bus::query()->whereIn('status', ['available', 'in_service']);
        $this->scopeBusesByTerminal($busQuery);

        $scheduleCountQuery = Schedule::query();
        $this->scopeSchedulesByTerminal($scheduleCountQuery);

        $available = 0;
        $total = 0;

        if ($this->isNorthTerminal()) {
            $available = NorthTerminalSpace::where('is_occupied', false)->count();
            $total = NorthTerminalSpace::count();
        } elseif ($this->isSouthTerminal()) {
            $available = TerminalSpace::where('is_occupied', false)->count();
            $total = TerminalSpace::count();
        } else {
            $available = Space::where('is_occupied', false)->count();
            $total = Space::count();
        }

        $pendingApprovals = $this->pendingOperatorApprovalCount();

        $scheduleAnalytics = Schedule::query();
        $this->scopeSchedulesByTerminal($scheduleAnalytics);

        $statusCountsRaw = $scheduleAnalytics->groupBy('status')
            ->selectRaw('status, COUNT(*) as count')
            ->pluck('count', 'status');

        $statusCounts = [
            'completed' => (int) ($statusCountsRaw['completed'] ?? 0),
            'active' => (int) ($statusCountsRaw['active'] ?? 0),
            'scheduled' => (int) ($statusCountsRaw['scheduled'] ?? 0),
            'cancelled' => (int) ($statusCountsRaw['cancelled'] ?? 0),
        ];

        $totalBuses = Bus::query();
        $busInService = Bus::query()->whereIn('status', ['available', 'in_service']);
        $this->scopeBusesByTerminal($totalBuses);
        $this->scopeBusesByTerminal($busInService);

        $totalBusesCount = $totalBuses->count();
        $busUtilizationPercent = $totalBusesCount > 0
            ? round(($busInService->count() / $totalBusesCount) * 100, 1)
            : 0;

        $spaceUtilizationPercent = $total > 0
            ? round((($total - $available) / $total) * 100, 1)
            : 0;

        $stats = [
            'active_busses' => $busQuery->count(),
            'available_spaces' => $available,
            'total_spaces' => $total,
            'total_schedules' => $scheduleCountQuery->count(),
            'pending_approvals' => $pendingApprovals,
        ];

        $analytics = [
            'status_counts' => $statusCounts,
            'bus_utilization' => $busUtilizationPercent,
            'total_buses' => $totalBusesCount,
            'buses_in_service' => $busInService->count(),
            'space_utilization' => $spaceUtilizationPercent,
            'total_spaces' => $total,
            'occupied_spaces' => $total - $available,
            'available_spaces' => $available,
            'occupancy_by_hour' => $this->getOccupancyByHour(),
        ];

        return view('operations.dashboard', compact('stats', 'busSchedules', 'statuses', 'analytics'));
    }

    private function getOccupancyByHour(): array
    {
        if ($this->isNorthTerminal()) {
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

        $occupancyData = $query->get();
        $hoursData = array_fill(0, 24, 0);
        foreach ($occupancyData as $data) {
            $hoursData[$data->hour] = $data->occupancy_count;
        }

        return $hoursData;
    }

    public function getAvailableSpaces()
    {
        $available = 0;
        $total = 0;

        if ($this->isNorthTerminal()) {
            $available = NorthTerminalSpace::where('is_occupied', false)->count();
            $total = NorthTerminalSpace::count();
        } elseif ($this->isSouthTerminal()) {
            $available = TerminalSpace::where('is_occupied', false)->count();
            $total = TerminalSpace::count();
        } else {
            $available = Space::where('is_occupied', false)->count();
            $total = Space::count();
        }

        return response()->json([
            'available' => $available,
            'total' => $total,
        ]);
    }

    private function pendingOperatorApprovalCount(): int
    {
        $terminal = Auth::user()?->terminal;
        $terminal = is_string($terminal) ? strtolower(trim($terminal)) : null;

        if ($terminal === null || $terminal === '') {
            return 0;
        }

        return DB::table('users')
            ->where('role', 'bus_operator')
            ->where('status', 'inactive')
            ->whereNull('status_reason_action')
            ->whereRaw('LOWER(terminal) = ?', [$terminal])
            ->count();
    }
}
