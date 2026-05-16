<?php

namespace App\Http\Controllers;

use App\Models\Route;
use App\Models\RouteApprovalRequest;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        $pendingRouteCount = RouteApprovalRequest::query()
            ->where('status', 'pending_sysadmin')
            ->count();

        $pendingStopsCount = RouteApprovalRequest::query()
            ->where('status', 'pending_stops')
            ->count();

        $pendingManagerCount = DB::table('managers')
            ->where('role', 'terminalManager')
            ->where('status', 'inactive')
            ->count();

        $weekStart = now()->startOfWeek();

        $approvedThisWeek = RouteApprovalRequest::query()
            ->where('status', 'approved')
            ->where('decided_at', '>=', $weekStart)
            ->count();

        $declinedThisWeek = RouteApprovalRequest::query()
            ->where('status', 'declined')
            ->where('decided_at', '>=', $weekStart)
            ->count();

        $approvedToday = RouteApprovalRequest::query()
            ->where('status', 'approved')
            ->whereDate('decided_at', today())
            ->count();

        $declinedToday = RouteApprovalRequest::query()
            ->where('status', 'declined')
            ->whereDate('decided_at', today())
            ->count();

        $pendingByTerminal = RouteApprovalRequest::query()
            ->where('status', 'pending_sysadmin')
            ->selectRaw('LOWER(COALESCE(terminal, "")) as terminal_key, COUNT(*) as total')
            ->groupBy('terminal_key')
            ->pluck('total', 'terminal_key');

        $pendingQueue = RouteApprovalRequest::query()
            ->with('operator')
            ->where('status', 'pending_sysadmin')
            ->orderByDesc('submitted_by_terminal_at')
            ->limit(10)
            ->get()
            ->map(function (RouteApprovalRequest $r) {
                return [
                    'request' => $r,
                    'route_names' => $this->routeNamesForRequest($r),
                ];
            });

        $recentDecisions = RouteApprovalRequest::query()
            ->with('operator')
            ->whereIn('status', ['approved', 'declined'])
            ->orderByDesc('decided_at')
            ->limit(8)
            ->get()
            ->map(function (RouteApprovalRequest $r) {
                return [
                    'request' => $r,
                    'route_names' => $this->routeNamesForRequest($r),
                ];
            });

        $decisionsToday = $approvedToday + $declinedToday;
        $needsAction = $pendingRouteCount > 0 || $pendingManagerCount > 0;

        return view('dashboard', compact(
            'pendingRouteCount',
            'pendingStopsCount',
            'pendingManagerCount',
            'approvedThisWeek',
            'declinedThisWeek',
            'approvedToday',
            'declinedToday',
            'decisionsToday',
            'pendingByTerminal',
            'pendingQueue',
            'recentDecisions',
            'needsAction',
        ));
    }

    private function routeNamesForRequest(RouteApprovalRequest $request): string
    {
        $ids = array_values(array_filter(array_map('intval', (array) ($request->route_ids ?? []))));
        if ($ids === []) {
            return '';
        }

        return Route::query()
            ->whereIn('id', $ids)
            ->orderBy('name')
            ->pluck('name')
            ->join(', ');
    }
}
