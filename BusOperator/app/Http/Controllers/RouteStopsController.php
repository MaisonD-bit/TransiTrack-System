<?php

namespace App\Http\Controllers;

use App\Models\Route;
use App\Models\RouteApprovalRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class RouteStopsController extends Controller
{
    public function index(): View
    {
        $data = $this->routeStopsIndexData();
        $listChecksum = $this->routeStopsListChecksum($data['requests']);

        return view('panels.route-stops', [
            'requests' => $data['requests'],
            'routePayloads' => $data['routePayloads'],
            'operatorTerminal' => $data['operatorTerminal'],
            'listChecksum' => $listChecksum,
        ]);
    }

    public function pollList(): JsonResponse
    {
        $data = $this->routeStopsIndexData();
        $checksum = $this->routeStopsListChecksum($data['requests']);
        $html = view('panels.route-stops-list', [
            'requests' => $data['requests'],
            'routePayloads' => $data['routePayloads'],
            'operatorTerminal' => $data['operatorTerminal'],
        ])->render();

        return response()->json([
            'checksum' => $checksum,
            'html' => $html,
        ]);
    }

    public function editRoute(RouteApprovalRequest $routeApprovalRequest, Route $route): View
    {
        $this->authorizeOperator($routeApprovalRequest);
        $this->assertEditable($routeApprovalRequest);
        $this->assertOperatorOwnsRoute($route);

        abort_unless(
            $this->requestContainsRouteId($routeApprovalRequest, (int) $route->id),
            404
        );

        $allRoutePayloads = $this->payloadsForRequest($routeApprovalRequest);
        $routePayload = [$this->mapRouteToPayload($route)];

        $initialJson = old(
            'stop_configuration',
            $routeApprovalRequest->stop_configuration
                ? json_encode($routeApprovalRequest->stop_configuration)
                : '[]'
        );

        return view('panels.route-stops-edit', [
            'routeApprovalRequest' => $routeApprovalRequest,
            'route' => $route,
            'routePayload' => $routePayload,
            'allRoutePayloads' => $allRoutePayloads,
            'operatorTerminal' => Auth::user()->terminal,
            'initialJson' => $initialJson,
        ]);
    }

    public function updateStops(Request $request, RouteApprovalRequest $routeApprovalRequest): RedirectResponse
    {
        $this->authorizeOperator($routeApprovalRequest);
        $this->assertEditable($routeApprovalRequest);

        $data = $request->validate([
            'stop_configuration' => ['required', 'json'],
        ]);

        $decoded = json_decode($data['stop_configuration'], true);
        if (! is_array($decoded)) {
            return back()->withErrors(['stop_configuration' => 'Invalid stop data.']);
        }

        $routeApprovalRequest->update([
            'stop_configuration' => $decoded,
        ]);

        return redirect()
            ->route('route-stops.index')
            ->with('success', 'Bus stops saved.');
    }

    public function submitToSysadmin(RouteApprovalRequest $routeApprovalRequest): RedirectResponse
    {
        $this->authorizeOperator($routeApprovalRequest);

        if ($routeApprovalRequest->status !== 'pending_stops') {
            return back()->with('error', 'This submission is not waiting for bus stops.');
        }

        $missingRoutes = $this->routesMissingStops($routeApprovalRequest);
        if ($missingRoutes !== []) {
            return back()->with(
                'error',
                'Add bus stops for every route before sending to sysadmin: '.implode(', ', $missingRoutes).'.'
            );
        }

        $routeApprovalRequest->update([
            'status' => 'pending_sysadmin',
            'submitted_for_sysadmin_at' => now(),
        ]);

        return redirect()
            ->route('route-stops.index')
            ->with('success', 'Sent to TransiTrack sysadmin for approval.');
    }

    /**
     * @return array{operatorTerminal: string|null, requests: Collection<int, RouteApprovalRequest>, routePayloads: array<int, array<int, array<string, mixed>>>}
     */
    private function routeStopsIndexData(): array
    {
        $userId = Auth::id();

        $requests = RouteApprovalRequest::query()
            ->where('operator_user_id', $userId)
            ->whereIn('status', ['pending_stops', 'pending_sysadmin'])
            ->orderByDesc('created_at')
            ->get();

        $routePayloads = [];
        foreach ($requests as $req) {
            $routePayloads[$req->id] = $this->payloadsForRequest($req);
        }

        return [
            'operatorTerminal' => Auth::user()->terminal,
            'requests' => $requests,
            'routePayloads' => $routePayloads,
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

    /**
     * @return array<int, array<string, mixed>>
     */
    private function payloadsForRequest(RouteApprovalRequest $req): array
    {
        $ids = array_map('intval', (array) ($req->route_ids ?? []));
        if ($ids === []) {
            return [];
        }

        return Route::query()
            ->whereIn('id', $ids)
            ->where('user_id', Auth::id())
            ->orderBy('name')
            ->get()
            ->map(fn (Route $r) => $this->mapRouteToPayload($r))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function mapRouteToPayload(Route $r): array
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

    /**
     * Route IDs in this submission that have no saved stops yet.
     *
     * @return list<string> Route names missing stops
     */
    private function routesMissingStops(RouteApprovalRequest $request): array
    {
        $routeIds = array_map('intval', (array) ($request->route_ids ?? []));
        if ($routeIds === []) {
            return [];
        }

        $routes = Route::query()
            ->whereIn('id', $routeIds)
            ->where('user_id', Auth::id())
            ->get()
            ->keyBy('id');

        $stopsByRouteId = [];
        foreach ((array) ($request->stop_configuration ?? []) as $block) {
            if (! is_array($block)) {
                continue;
            }
            $rid = (int) ($block['route_id'] ?? 0);
            $stops = $block['stops'] ?? [];
            if ($rid > 0 && is_array($stops) && count($stops) > 0) {
                $stopsByRouteId[$rid] = true;
            }
        }

        $missing = [];
        foreach ($routeIds as $rid) {
            if (empty($stopsByRouteId[$rid])) {
                $missing[] = $routes->get($rid)?->name ?? "Route #{$rid}";
            }
        }

        return $missing;
    }

    private function requestContainsRouteId(RouteApprovalRequest $request, int $routeId): bool
    {
        foreach ((array) ($request->route_ids ?? []) as $id) {
            if ((int) $id === $routeId) {
                return true;
            }
        }

        return false;
    }

    private function authorizeOperator(RouteApprovalRequest $routeApprovalRequest): void
    {
        abort_if($routeApprovalRequest->operator_user_id !== Auth::id(), 403);
    }

    private function assertEditable(RouteApprovalRequest $routeApprovalRequest): void
    {
        abort_if($routeApprovalRequest->status !== 'pending_stops', 403);
    }

    private function assertOperatorOwnsRoute(Route $route): void
    {
        abort_if((int) $route->user_id !== (int) Auth::id(), 403);
    }
}
