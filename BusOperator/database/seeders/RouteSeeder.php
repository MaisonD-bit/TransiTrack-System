<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Route;
use App\Models\RouteApprovalRequest;
use App\Models\User;
use App\Models\SysadminUser;
use Illuminate\Support\Facades\DB;

class RouteSeeder extends Seeder
{
    public function run(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        DB::table('route_approval_requests')->truncate();
        DB::table('route_stops')->truncate();
        DB::table('routes')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        $adminId   = User::where('role', 'admin')->value('id') ?? 1;
        $sysadminId = SysadminUser::first()?->id ?? 1;

       
        $northApprovalData = $this->createRoutesAndBuildConfig($northRoutes, 'north', $adminId);
        $southApprovalData = $this->createRoutesAndBuildConfig($southRoutes, 'south', $adminId);

        $now = now();

        // Create approved RouteApprovalRequest for North Terminal
        RouteApprovalRequest::create([
            'operator_user_id'          => $adminId,
            'terminal'                  => 'north',
            'route_ids'                 => $northApprovalData['route_ids'],
            'stop_configuration'        => $northApprovalData['stop_configuration'],
            'status'                    => 'approved',
            'submitted_by_operator_at'  => $now,
            'submitted_by_terminal_at'  => $now,
            'decided_at'                => $now,
            'decided_by_sysadmin_id'    => $sysadminId,
            'sysadmin_notes'            => 'Seeded for testing',
        ]);

        // Create approved RouteApprovalRequest for South Terminal
        RouteApprovalRequest::create([
            'operator_user_id'          => $adminId,
            'terminal'                  => 'south',
            'route_ids'                 => $southApprovalData['route_ids'],
            'stop_configuration'        => $southApprovalData['stop_configuration'],
            'status'                    => 'approved',
            'submitted_by_operator_at'  => $now,
            'submitted_by_terminal_at'  => $now,
            'decided_at'                => $now,
            'decided_by_sysadmin_id'    => $sysadminId,
            'sysadmin_notes'            => 'Seeded for testing',
        ]);
    }

    private function createRoutesAndBuildConfig(array $routeDefinitions, string $terminal, int $adminId): array
    {
        $routeIds = [];
        $stopConfig = [];

        foreach ($routeDefinitions as $def) {
            [$startName, $startLng, $startLat] = $def['start'];
            $lastStop = end($def['via']);
            [$endName] = $lastStop;

            $isAircon     = $def['bus_type'] === 'aircon';
            $regularPrice = $isAircon ? null : $def['price'];
            $airconPrice  = $isAircon ? $def['price'] : null;

            $geometry = $this->fetchMapboxGeometry($startLng, $startLat, $def['via']);

            $route = Route::create([
                'user_id'            => $adminId,
                'name'               => $def['name'],
                'code'               => $def['code'],
                'terminal'           => $terminal,
                'start_location'     => $startName,
                'end_location'       => $endName,
                'description'        => $def['name'] . ' — test route',
                'regular_price'      => $regularPrice,
                'aircon_price'       => $airconPrice,
                'distance_km'        => $def['distance_km'],
                'estimated_duration' => $def['duration'],
                'status'             => 'active',
                'bus_type'           => $def['bus_type'],
                'geometry'           => $geometry,
            ]);

            $routeIds[] = $route->id;
            $stopConfig[] = [
                'route_id' => $route->id,
                'label'    => $def['name'],
                'stops'    => $this->buildStops($def['start'], $def['via']),
            ];
        }

        return ['route_ids' => $routeIds, 'stop_configuration' => $stopConfig];
    }

    /**
     * Fetch real road geometry from Mapbox Directions API.
     * Falls back to a multi-point LineString using stop coordinates if unavailable.
     */
    private function fetchMapboxGeometry(float $startLng, float $startLat, array $via): string
    {
        $mapboxToken = env('MAPBOX_TOKEN');

        if ($mapboxToken && $mapboxToken !== 'your-mapbox-token') {
            [$endName, $endLng, $endLat] = end($via);
            $url = "https://api.mapbox.com/directions/v5/mapbox/driving/{$startLng},{$startLat};{$endLng},{$endLat}?geometries=geojson&access_token={$mapboxToken}";
            $response = @file_get_contents($url);
            if ($response) {
                $data = json_decode($response, true);
                if (isset($data['routes'][0]['geometry'])) {
                    return json_encode($data['routes'][0]['geometry']);
                }
            }
        }

        // Multi-point fallback using all known stop coordinates
        $coords = [[$startLng, $startLat]];
        foreach ($via as [$name, $lng, $lat]) {
            $coords[] = [$lng, $lat];
        }

        return json_encode(['type' => 'LineString', 'coordinates' => $coords]);
    }

    private function buildStops(array $start, array $via): array
    {
        $stops = [[
            'name'                  => $start[0],
            'lng'                   => $start[1],
            'lat'                   => $start[2],
            'order'                 => 0,
            'distance_km_from_start' => 0,
        ]];

        foreach ($via as $i => [$name, $lng, $lat, $distKm]) {
            $stops[] = [
                'name'                  => $name,
                'lng'                   => $lng,
                'lat'                   => $lat,
                'order'                 => $i + 1,
                'distance_km_from_start' => $distKm,
            ];
        }

        return $stops;
    }
}
