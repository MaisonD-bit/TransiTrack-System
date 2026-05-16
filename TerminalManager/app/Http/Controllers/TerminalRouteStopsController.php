<?php

namespace App\Http\Controllers;

use App\Models\BusRoute;
use App\Models\RouteApprovalRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Collection;

class TerminalRouteStopsController extends Controller
{
    public function index()
    {
        $data = $this->routeStopsIndexData();
        $listChecksum = $this->routeStopsListChecksum($data['requests']);

        return view('operations.route-stops', [
            'routePayloads' => $data['routePayloads'],
            'terminal' => $data['terminal'],
            'groupedByOperator' => $data['groupedByOperator'],
            'listChecksum' => $listChecksum,
        ]);
    }

    /**
     * JSON for live refresh of the route-approval list (no full page reload).
     */
    public function pollList(): JsonResponse
    {
        $data = $this->routeStopsIndexData();
        $checksum = $this->routeStopsListChecksum($data['requests']);
        $html = view('operations.partials.route-stops-list', [
            'groupedByOperator' => $data['groupedByOperator'],
            'routePayloads' => $data['routePayloads'],
            'terminal' => $data['terminal'],
        ])->render();

        return response()->json([
            'checksum' => $checksum,
            'html' => $html,
        ]);
    }

    /**
     * @return array{terminal: string, requests: Collection<int, RouteApprovalRequest>, routePayloads: array<int, array<int, array<string, mixed>>>, groupedByOperator: Collection}
     */
    private function routeStopsIndexData(): array
    {
        $terminal = Auth::user()->terminal ?? null;
        abort_if(! $terminal, 403, 'Your account has no terminal assigned.');

        $terminalNorm = strtolower((string) $terminal);

        $requests = RouteApprovalRequest::query()
            ->whereRaw('LOWER(COALESCE(terminal, "")) = ?', [$terminalNorm])
            ->whereIn('status', ['pending_stops', 'pending_sysadmin'])
            ->orderByDesc('created_at')
            ->with('operator')
            ->get();

        $routePayloads = [];
        foreach ($requests as $req) {
            $routePayloads[$req->id] = $this->payloadsForRequest($req);
        }

        $groupedByOperator = $requests->groupBy('operator_user_id');

        return [
            'terminal' => $terminal,
            'requests' => $requests,
            'routePayloads' => $routePayloads,
            'groupedByOperator' => $groupedByOperator,
        ];
    }

    private function routeStopsListChecksum(Collection $requests): string
    {
        if ($requests->isEmpty()) {
            return 'empty';
        }

        $parts = $requests->sortBy('id')->map(function (RouteApprovalRequest $r) {
            $ts = $r->updated_at instanceof \Carbon\CarbonInterface
                ? $r->updated_at->toIso8601String()
                : (string) $r->updated_at;

            return $r->id.'|'.$r->status.'|'.$ts;
        })->values()->all();

        return hash('sha256', implode(';;', $parts));
    }

    public function editRoute(RouteApprovalRequest $routeApprovalRequest, BusRoute $busRoute)
    {
        $terminal = Auth::user()->terminal ?? null;
        abort_if(! $terminal, 403);
        abort_if(
            strtolower((string) $routeApprovalRequest->terminal) !== strtolower((string) $terminal),
            403
        );

        abort_unless(
            $this->requestContainsRouteId($routeApprovalRequest, (int) $busRoute->id),
            404
        );

        abort_if($routeApprovalRequest->status !== 'pending_stops', 403);

        $routeApprovalRequest->load('operator');

        $allRoutePayloads = $this->payloadsForRequest($routeApprovalRequest);
        $routePayload = [$this->mapBusRouteToPayload($busRoute)];

        $initialJson = old(
            'stop_configuration',
            $routeApprovalRequest->stop_configuration
                ? json_encode($routeApprovalRequest->stop_configuration)
                : '[]'
        );

        return view('operations.route-stops-edit', compact(
            'routeApprovalRequest',
            'busRoute',
            'routePayload',
            'allRoutePayloads',
            'terminal',
            'initialJson'
        ));
    }

    public function updateStops(Request $request, RouteApprovalRequest $routeApprovalRequest)
    {
        $this->authorizeTerminal($routeApprovalRequest);

        $data = $request->validate([
            'stop_configuration' => ['required', 'json'],
        ]);

        $decoded = json_decode($data['stop_configuration'], true);
        if (! is_array($decoded)) {
            return back()->withErrors(['stop_configuration' => 'Invalid JSON.']);
        }

        $routeApprovalRequest->update([
            'stop_configuration' => $decoded,
        ]);

        return redirect()
            ->route('terminal.route-stops')
            ->with('success', 'Bus stops saved.');
    }

    public function submitToSysadmin(RouteApprovalRequest $routeApprovalRequest)
    {
        $this->authorizeTerminal($routeApprovalRequest);

        if ($routeApprovalRequest->status !== 'pending_stops') {
            return back()->with('error', 'This request is not waiting for terminal stops.');
        }
        if (empty($routeApprovalRequest->stop_configuration)) {
            return back()->with('error', 'Add bus stops before sending to sysadmin.');
        }

        $routeApprovalRequest->update([
            'status' => 'pending_sysadmin',
            'submitted_by_terminal_at' => now(),
        ]);

        return redirect()->route('terminal.route-stops')->with('success', 'Sent to TransiTrack sysadmin for approval.');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    /**
     * JSON `route_ids` may be int or string; avoid strict in_array false negatives.
     */
    private function requestContainsRouteId(RouteApprovalRequest $r, int $routeId): bool
    {
        foreach ((array) ($r->route_ids ?? []) as $id) {
            if ((int) $id === $routeId) {
                return true;
            }
        }

        return false;
    }

    private function payloadsForRequest(RouteApprovalRequest $req): array
    {
        $ids = array_map('intval', (array) ($req->route_ids ?? []));
        if ($ids === []) {
            return [];
        }

        return BusRoute::query()
            ->whereIn('id', $ids)
            ->orderBy('name')
            ->get()
            ->map(fn (BusRoute $r) => $this->mapBusRouteToPayload($r))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function mapBusRouteToPayload(BusRoute $r): array
    {
        $g = $r->geometry;
        if (is_string($g)) {
            $g = json_decode($g, true);
        }

        return [
            'id' => $r->id,
            'name' => $r->name,
            'code' => $r->code,
            'geometry' => $g,
            'start_location' => $r->start_location ?? '',
            'end_location' => $r->end_location ?? '',
            'start_coordinates' => $r->start_coordinates ?? '',
            'end_coordinates' => $r->end_coordinates ?? '',
            'distance_km' => (float) ($r->distance_km ?? 0),
            'regular_price' => (float) ($r->regular_price ?? $r->route_fare ?? 0),
            'aircon_price' => (float) ($r->aircon_price ?? $r->route_fare ?? 0),
            'bus_type' => $r->bus_type ?? 'regular',
        ];
    }

    private function authorizeTerminal(RouteApprovalRequest $routeApprovalRequest): void
    {
        $t = Auth::user()->terminal ?? null;
        abort_if(! $t, 403);
        abort_if(
            strtolower((string) $routeApprovalRequest->terminal) !== strtolower((string) $t),
            403
        );
    }
}
