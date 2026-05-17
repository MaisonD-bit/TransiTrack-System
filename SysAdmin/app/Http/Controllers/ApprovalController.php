<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\Route as BusRoute;
use App\Models\RouteApprovalRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;

class ApprovalController extends Controller
{
    public function index()
    {
        $pending = $this->pendingItems();
        $history = $this->historyItems();
        $pollSignature = $this->pollSignature($pending, $history);

        return view('approvals.index', compact('pending', 'history', 'pollSignature'));
    }

    public function poll()
    {
        $pending = $this->pendingItems();
        $history = $this->historyItems();

        return response()->json([
            'signature' => $this->pollSignature($pending, $history),
            'pending_rows' => view('approvals.partials.pending-tbody', compact('pending'))->render(),
            'history_rows' => view('approvals.partials.history-tbody', compact('history'))->render(),
        ]);
    }

    public function review(RouteApprovalRequest $routeApprovalRequest)
    {
        abort_unless($routeApprovalRequest->status === 'pending_sysadmin', 404);

        $routeApprovalRequest->load('operator');

        $ids = array_values(array_filter(array_map('intval', (array) ($routeApprovalRequest->route_ids ?? []))));
        $routes = BusRoute::query()
            ->whereIn('id', $ids)
            ->orderBy('name')
            ->get();

        $stopConfig = $routeApprovalRequest->stop_configuration ?? [];
        $layers = [];
        foreach ($routes as $route) {
            $block = collect($stopConfig)->first(fn ($b) => (int) ($b['route_id'] ?? 0) === (int) $route->id);
            $g = $route->geometry;
            if (is_string($g)) {
                $g = json_decode($g, true);
            }
            $layers[] = [
                'id' => $route->id,
                'name' => $route->name,
                'code' => $route->code,
                'geometry' => $g,
                'start_location' => $route->start_location ?? '',
                'end_location' => $route->end_location ?? '',
                'start_coordinates' => $route->start_coordinates ?? '',
                'end_coordinates' => $route->end_coordinates ?? '',
                'stops' => $block['stops'] ?? [],
            ];
        }

        return view('approvals.review', [
            'routeApprovalRequest' => $routeApprovalRequest,
            'layers' => $layers,
        ]);
    }

    public function approve(RouteApprovalRequest $routeApprovalRequest)
    {
        $this->authorizePending($routeApprovalRequest);

        $routeApprovalRequest->update([
            'status' => 'approved',
            'decided_at' => now(),
            'decided_by_sysadmin_id' => Auth::guard('sysadmin')->id(),
            'decline_reason' => null,
            'sysadmin_notes' => null,
        ]);

        $ids = array_values(array_filter(array_map('intval', (array) ($routeApprovalRequest->route_ids ?? []))));
        if ($ids !== []) {
            BusRoute::query()->whereIn('id', $ids)->update(['status' => 'active']);
        }

        Notification::create([
            'type' => 'route_approval',
            'message' => 'Your route configuration for terminal '.strtoupper((string) $routeApprovalRequest->terminal).' has been APPROVED. You may assign drivers for daily operations.',
            'sender_id' => null,
            'recipient_id' => $routeApprovalRequest->operator_user_id,
            'driver_id' => null,
            'schedule_id' => null,
            'bus_id' => null,
            'route_approval_request_id' => $routeApprovalRequest->id,
            'is_read' => false,
        ]);

        return redirect()
            ->route('sysadmin.approvals')
            ->with('success', 'Approved. The bus operator was notified in their Notifications panel.');
    }

    public function decline(Request $request, RouteApprovalRequest $routeApprovalRequest)
    {
        $this->authorizePending($routeApprovalRequest);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $reason = $data['reason'] ?? null;

        $routeApprovalRequest->update([
            'status' => 'declined',
            'decided_at' => now(),
            'decided_by_sysadmin_id' => Auth::guard('sysadmin')->id(),
            'decline_reason' => $reason,
        ]);

        $reasonText = $reason ? ' Reason: '.$reason : '';

        Notification::create([
            'type' => 'route_approval',
            'message' => 'Your route configuration for terminal '.strtoupper((string) $routeApprovalRequest->terminal).' was DECLINED.'.$reasonText,
            'sender_id' => null,
            'recipient_id' => $routeApprovalRequest->operator_user_id,
            'driver_id' => null,
            'schedule_id' => null,
            'bus_id' => null,
            'route_approval_request_id' => $routeApprovalRequest->id,
            'is_read' => false,
        ]);

        return redirect()
            ->route('sysadmin.approvals')
            ->with('success', 'Declined. The bus operator was notified.');
    }

    private function pendingItems(): Collection
    {
        $pending = RouteApprovalRequest::query()
            ->with('operator')
            ->where('status', 'pending_sysadmin')
            ->orderByDesc('submitted_by_terminal_at')
            ->orderByDesc('created_at')
            ->get();

        return $pending->map(function (RouteApprovalRequest $r) {
            $ids = array_values(array_filter(array_map('intval', (array) ($r->route_ids ?? []))));
            $names = $ids === []
                ? collect()
                : BusRoute::query()->whereIn('id', $ids)->orderBy('name')->pluck('name');

            return [
                'request' => $r,
                'route_names' => $names->join(', '),
            ];
        });
    }

    private function historyItems(): Collection
    {
        return RouteApprovalRequest::query()
            ->with(['operator', 'decidedBy'])
            ->whereIn('status', ['approved', 'declined'])
            ->orderByDesc('decided_at')
            ->limit(25)
            ->get();
    }

    private function pollSignature(Collection $pending, Collection $history): string
    {
        $p = $pending->map(function (array $item) {
            $r = $item['request'];

            return $r->id.':'.($r->updated_at?->timestamp ?? 0).':'.($r->submitted_by_terminal_at?->timestamp ?? 0);
        })->sort()->values()->implode(',');

        $h = $history->map(fn (RouteApprovalRequest $r) => $r->id.':'.$r->status.':'.($r->decided_at?->timestamp ?? 0))
            ->sort()
            ->values()
            ->implode(',');

        $pendingCount = RouteApprovalRequest::query()->where('status', 'pending_sysadmin')->count();

        return md5($p.'|'.$h.'|'.$pendingCount);
    }

    private function authorizePending(RouteApprovalRequest $routeApprovalRequest): void
    {
        abort_unless($routeApprovalRequest->status === 'pending_sysadmin', 404);
    }
}
