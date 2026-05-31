<?php

namespace App\Http\Controllers;

use App\Models\Route;
use App\Models\RouteApprovalRequest;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        $data = $this->dashboardData();

        return view('dashboard', $data + [
            'pollSignature' => $this->dashboardPollSignature($data),
        ]);
    }

    public function poll()
    {
        $data = $this->dashboardData();

        return response()->json([
            'signature' => $this->dashboardPollSignature($data),
            'pending_route_count' => $data['pendingRouteCount'],
            'pending_manager_count' => $data['pendingManagerCount'],
            'pending_stops_count' => $data['pendingStopsCount'],
            'decisions_today' => $data['decisionsToday'],
            'needs_action' => $data['needsAction'],
            'pending_queue_html' => view('dashboard.partials.pending-queue-tbody', [
                'pendingQueue' => $data['pendingQueue'],
            ])->render(),
            'recent_decisions_html' => view('dashboard.partials.recent-decisions-tbody', [
                'recentDecisions' => $data['recentDecisions'],
            ])->render(),
            'terminal_badges_html' => view('dashboard.partials.terminal-badges', [
                'pendingByTerminal' => $data['pendingByTerminal'],
            ])->render(),
        ]);
    }

    private function dashboardData(): array
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
            ->orderByRaw('COALESCE(submitted_for_sysadmin_at, submitted_by_terminal_at) DESC')
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

        return compact(
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
        );
    }

    private function dashboardPollSignature(array $data): string
    {
        $queue = collect($data['pendingQueue'])->map(function (array $item) {
            $r = $item['request'];

            return $r->id.':'.($r->updated_at?->timestamp ?? 0);
        })->sort()->values()->implode(',');

        $recent = collect($data['recentDecisions'])->map(function (array $item) {
            $r = $item['request'];

            return $r->id.':'.$r->status.':'.($r->decided_at?->timestamp ?? 0);
        })->sort()->values()->implode(',');

        return md5(
            $data['pendingRouteCount'].'|'.
            $data['pendingManagerCount'].'|'.
            $data['pendingStopsCount'].'|'.
            $data['decisionsToday'].'|'.
            (int) $data['needsAction'].'|'.
            $queue.'|'.$recent
        );
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
