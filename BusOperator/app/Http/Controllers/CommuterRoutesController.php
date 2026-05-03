<?php

namespace App\Http\Controllers;

use App\Models\Route;
use App\Models\RouteApprovalRequest;
use Illuminate\Http\Request;

class CommuterRoutesController extends Controller
{
    /**
     * Approved routes with terminal-manager stops (public API for commuter app).
     */
    public function approvedRoutes(Request $request)
    {
        $terminal = $request->query('terminal', 'north');
        $busType = $request->query('bus_type', 'regular');

        if (! in_array($busType, ['regular', 'aircon'], true)) {
            $busType = 'regular';
        }

        $packages = RouteApprovalRequest::query()
            ->where('status', 'approved')
            ->where('terminal', $terminal)
            ->orderByDesc('decided_at')
            ->get();

        $routes = [];
        $seenRouteIds = [];

        foreach ($packages as $pkg) {
            $config = $pkg->stop_configuration;
            if (! is_array($config)) {
                continue;
            }

            foreach ($config as $block) {
                $routeId = $block['route_id'] ?? null;
                if (! $routeId) {
                    continue;
                }

                $route = Route::query()->find($routeId);
                if (! $route || ($route->bus_type ?? 'regular') !== $busType) {
                    continue;
                }

                if (isset($seenRouteIds[$routeId])) {
                    continue;
                }
                $seenRouteIds[$routeId] = true;

                $geometry = $route->geometry;
                if (is_string($geometry)) {
                    $geometry = json_decode($geometry, true);
                }

                $routes[] = [
                    'approval_request_id' => $pkg->id,
                    'route_id' => $route->id,
                    'name' => $route->name,
                    'code' => $route->code,
                    'bus_type' => $route->bus_type,
                    'geometry' => $geometry,
                    'distance_km' => (float) ($route->distance_km ?? 0),
                    'regular_price' => (float) ($route->regular_price ?? $route->route_fare ?? 0),
                    'aircon_price' => (float) ($route->aircon_price ?? $route->route_fare ?? 0),
                    'stops' => $block['stops'] ?? [],
                    'label' => $block['label'] ?? $route->name,
                ];
            }
        }

        return response()->json([
            'routes' => $routes,
            'terminal' => $terminal,
            'bus_type' => $busType,
        ]);
    }

    /**
     * Fare to pay when alighting at a specific stop (distance-proportional).
     */
    public function farePreview(Request $request)
    {
        $data = $request->validate([
            'route_id' => ['required', 'integer', 'exists:routes,id'],
            'bus_type' => ['required', 'in:regular,aircon'],
            'stop_index' => ['required', 'integer', 'min:0'],
            'approval_request_id' => ['nullable', 'integer', 'exists:route_approval_requests,id'],
        ]);

        $route = Route::query()->findOrFail($data['route_id']);

        $pkg = null;
        if (! empty($data['approval_request_id'])) {
            $pkg = RouteApprovalRequest::query()
                ->where('status', 'approved')
                ->find($data['approval_request_id']);
        }
        if (! $pkg) {
            $pkg = RouteApprovalRequest::query()
                ->where('status', 'approved')
                ->orderByDesc('decided_at')
                ->get()
                ->first(function ($p) use ($data) {
                    return in_array((int) $data['route_id'], $p->route_ids ?? [], true);
                });
        }

        $fullKm = max((float) ($route->distance_km ?? 0), 0.001);
        $fullFareRegular = (float) ($route->regular_price ?? $route->route_fare ?? 0);
        $fullFareAircon = (float) ($route->aircon_price ?? $route->route_fare ?? 0);
        $fullFare = $data['bus_type'] === 'aircon' ? $fullFareAircon : $fullFareRegular;

        $stopDist = $fullKm;
        $selectedStop = null;

        if ($pkg && is_array($pkg->stop_configuration)) {
            foreach ($pkg->stop_configuration as $block) {
                if ((int) ($block['route_id'] ?? 0) !== (int) $data['route_id']) {
                    continue;
                }
                $stops = $block['stops'] ?? [];
                $idx = $data['stop_index'];
                if (! isset($stops[$idx])) {
                    continue;
                }
                $selectedStop = $stops[$idx];
                $stopDist = (float) ($selectedStop['distance_km_from_start'] ?? $fullKm);
                break;
            }
        }

        $ratio = min(1, max(0, $stopDist / $fullKm));
        $fare = round($fullFare * $ratio, 2);

        return response()->json([
            'success' => true,
            'data' => [
                'fare' => $fare,
                'ratio' => $ratio,
                'distance_km_to_stop' => $stopDist,
                'full_route_distance_km' => $fullKm,
                'full_route_fare' => $fullFare,
                'stop' => $selectedStop,
            ],
        ]);
    }
}
