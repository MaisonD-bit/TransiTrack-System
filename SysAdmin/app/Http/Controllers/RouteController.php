<?php

namespace App\Http\Controllers;

use App\Models\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class RouteController extends Controller
{
    public function index(Request $request)
    {
        $query = Route::query();

        if ($request->filled('terminal')) {
            $query->where('terminal', $request->terminal);
        }

        if ($request->filled('search')) {
            $searchTerm = $request->search;
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', "%{$searchTerm}%")
                    ->orWhere('code', 'like', "%{$searchTerm}%")
                    ->orWhere('start_location', 'like', "%{$searchTerm}%")
                    ->orWhere('end_location', 'like', "%{$searchTerm}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('bus_type')) {
            $query->where('bus_type', $request->bus_type);
        }

        $statsQuery = clone $query;
        $routes = $query->orderByDesc('created_at')->paginate(15)->withQueryString();

        $stats = [
            'total_routes' => (clone $statsQuery)->count(),
            'active_routes' => (clone $statsQuery)->where('status', 'active')->count(),
            'inactive_routes' => (clone $statsQuery)->where('status', 'inactive')->count(),
        ];

        return view('routes.index', compact('routes', 'stats'));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:255|unique:routes,code',
            'terminal' => 'required|in:north,south',
            'start_location' => 'required|string',
            'end_location' => 'required|string',
            'start_coordinates' => 'required|string',
            'end_coordinates' => 'required|string',
            'distance_km' => 'required|numeric|min:0',
            'estimated_duration' => 'required|integer|min:0',
            'description' => 'nullable|string',
            'route_fare' => 'required|numeric|min:0',
            'bus_type' => 'required|in:regular,aircon',
            'status' => 'required|in:active,inactive',
            'geometry' => 'required|string',
            'stops_data' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $data = $request->all();
            if (isset($data['stops_data']) && is_string($data['stops_data'])) {
                $data['stops_data'] = json_decode($data['stops_data'], true);
            }

            $routeFare = (float) $data['route_fare'];
            if ($data['bus_type'] === 'aircon') {
                $data['aircon_price'] = $routeFare;
                $data['regular_price'] = round($routeFare / 1.18, 2);
            } else {
                $data['regular_price'] = $routeFare;
                $data['aircon_price'] = round($routeFare * 1.18, 2);
            }

            $this->syncReturnGeometryAndStops($data);

            $route = Route::create(array_merge($data, [
                'user_id' => null,
            ]));

            return response()->json([
                'success' => true,
                'message' => 'Route created successfully',
                'route' => $route,
            ], 201);
        } catch (\Exception $e) {
            Log::error('SysAdmin route creation error: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to create route: '.$e->getMessage(),
            ], 500);
        }
    }

    public function show($id)
    {
        try {
            $route = Route::findOrFail($id);

            $geometry = is_string($route->geometry) ? json_decode($route->geometry, true) : $route->geometry;
            $stopsArr = [];
            if ($route->stops_data) {
                $stopsData = $route->stops_data;
                if (is_string($stopsData)) {
                    $stopsArr = json_decode($stopsData, true) ?: [];
                } elseif (is_array($stopsData)) {
                    $stopsArr = $stopsData;
                }
            }

            return response()->json([
                'success' => true,
                'route' => [
                    'id' => $route->id,
                    'name' => $route->name,
                    'code' => $route->code,
                    'start_location' => $route->start_location,
                    'end_location' => $route->end_location,
                    'start_coordinates' => $route->start_coordinates ?? '',
                    'end_coordinates' => $route->end_coordinates ?? '',
                    'description' => $route->description,
                    'regular_price' => $route->regular_price,
                    'aircon_price' => $route->aircon_price,
                    'distance_km' => $route->distance_km,
                    'estimated_duration' => $route->estimated_duration,
                    'bus_type' => $route->bus_type,
                    'route_fare' => $route->route_fare,
                    'status' => $route->status,
                    'terminal' => $route->terminal,
                    'has_return_trip' => ! empty($route->return_geometry),
                    'geometry' => $geometry,
                    'stops_data' => $stopsArr,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('SysAdmin route show error: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Route not found',
            ], 404);
        }
    }

    public function update(Request $request, $id)
    {
        $route = Route::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'string|max:255',
            'code' => 'string|max:255|unique:routes,code,'.$id,
            'terminal' => 'in:north,south',
            'start_location' => 'string|max:255',
            'end_location' => 'string|max:255',
            'description' => 'nullable|string',
            'route_fare' => 'required|numeric|min:0',
            'distance_km' => 'numeric|min:0',
            'estimated_duration' => 'integer|min:1',
            'bus_type' => 'required|string|in:regular,aircon',
            'status' => 'string|in:active,inactive',
            'geometry' => 'required|string',
            'stops_data' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $data = $request->all();

            if (isset($data['stops_data']) && is_string($data['stops_data'])) {
                $data['stops_data'] = json_decode($data['stops_data'], true);
            }

            if (isset($data['route_fare'], $data['bus_type'])) {
                $routeFare = (float) $data['route_fare'];
                if ($data['bus_type'] === 'aircon') {
                    $data['aircon_price'] = $routeFare;
                    $data['regular_price'] = round($routeFare / 1.18, 2);
                } else {
                    $data['regular_price'] = $routeFare;
                    $data['aircon_price'] = round($routeFare * 1.18, 2);
                }
            }

            $this->syncReturnGeometryAndStops($data, $route);
            $route->update($data);

            return response()->json([
                'success' => true,
                'message' => 'Route updated successfully',
                'route' => $route,
            ]);
        } catch (\Exception $e) {
            Log::error('SysAdmin route update error: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to update route',
            ], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $route = Route::findOrFail($id);
            $route->delete();

            return response()->json([
                'success' => true,
                'message' => 'Route deleted successfully',
            ]);
        } catch (\Exception $e) {
            Log::error('SysAdmin route deletion error: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete route',
            ], 500);
        }
    }

    private function syncReturnGeometryAndStops(array &$data, ?Route $existingRoute = null): void
    {
        if (! empty($data['geometry'])) {
            $geo = json_decode($data['geometry'], true);
            if (isset($geo['coordinates'])) {
                $geo['coordinates'] = array_reverse($geo['coordinates']);
                $data['return_geometry'] = json_encode($geo);
            }
        }

        if (array_key_exists('stops_data', $data)) {
            $stops = is_array($data['stops_data']) ? $data['stops_data'] : [];
            $data['return_stops_data'] = array_reverse($stops);

            return;
        }

        if ($existingRoute && ! empty($data['geometry'])) {
            $existingStops = $this->decodeStopsData($existingRoute->stops_data);
            if ($existingStops !== null) {
                $data['return_stops_data'] = array_reverse($existingStops);
            }
        }
    }

    private function decodeStopsData(mixed $stopsData): ?array
    {
        if ($stopsData === null) {
            return null;
        }
        if (is_array($stopsData)) {
            return $stopsData;
        }
        if (is_string($stopsData)) {
            $decoded = json_decode($stopsData, true);

            return is_array($decoded) ? $decoded : null;
        }

        return null;
    }
}
