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

        // ── North Terminal ─────────────────────────────────────────────────
        // Each route: ['name','code','bus_type','price','distance_km','duration',
        //              'start'=>[name,lng,lat], 'via'=>[[name,lng,lat,km],...]]
        // Last entry in 'via' is the terminus.

        $northRoutes = [
            // 1 — Regular short
            [
                'name'        => 'Cebu to Consolacion',
                'code'        => 'NT-CON-REG',
                'bus_type'    => 'regular',
                'price'       => 14.00,
                'distance_km' => 14.0,
                'duration'    => 35,
                'start'       => ['Cebu North Bus Terminal', 123.9172, 10.3156],
                'via'         => [
                    ['Mandaue City', 123.9394, 10.3328,  5.2],
                    ['Consolacion',  123.9617, 10.3741, 14.0],
                ],
            ],
            // 2 — Regular medium
            [
                'name'        => 'Cebu to Danao City',
                'code'        => 'NT-DAN-REG',
                'bus_type'    => 'regular',
                'price'       => 45.00,
                'distance_km' => 45.0,
                'duration'    => 90,
                'start'       => ['Cebu North Bus Terminal', 123.9172, 10.3156],
                'via'         => [
                    ['Mandaue City', 123.9394, 10.3328,  5.2],
                    ['Consolacion',  123.9617, 10.3741, 14.0],
                    ['Liloan',       123.9833, 10.3972, 21.5],
                    ['Danao City',   124.0247, 10.5207, 45.0],
                ],
            ],
            // 3 — Regular long
            [
                'name'        => 'Cebu to Hagnaya Port',
                'code'        => 'NT-HAG-REG',
                'bus_type'    => 'regular',
                'price'       => 120.00,
                'distance_km' => 100.0,
                'duration'    => 160,
                'start'       => ['Cebu North Bus Terminal', 123.9172, 10.3156],
                'via'         => [
                    ['Danao City',   124.0247, 10.5207,  45.0],
                    ['San Remigio',  123.9400, 11.0800,  80.0],
                    ['Hagnaya Port', 123.8244, 11.1223, 100.0],
                ],
            ],
            // 4 — Regular longest
            [
                'name'        => 'Cebu to Maya (Daan Bantayan)',
                'code'        => 'NT-MAYA-REG',
                'bus_type'    => 'regular',
                'price'       => 150.00,
                'distance_km' => 135.0,
                'duration'    => 220,
                'start'       => ['Cebu North Bus Terminal', 123.9172, 10.3156],
                'via'         => [
                    ['Danao City',    124.0247, 10.5207,  45.0],
                    ['Daan Bantayan', 124.0552, 11.2766, 120.0],
                    ['Maya Port',     124.0122, 11.3181, 135.0],
                ],
            ],
            // 5 — Air-con
            [
                'name'        => 'Cebu to Danao City (Aircon)',
                'code'        => 'NT-DAN-AC',
                'bus_type'    => 'aircon',
                'price'       => 65.00,
                'distance_km' => 45.0,
                'duration'    => 90,
                'start'       => ['Cebu North Bus Terminal', 123.9172, 10.3156],
                'via'         => [
                    ['Consolacion', 123.9617, 10.3741, 14.0],
                    ['Liloan',      123.9833, 10.3972, 21.5],
                    ['Danao City',  124.0247, 10.5207, 45.0],
                ],
            ],
        ];

        // ── South Terminal ─────────────────────────────────────────────────
        $southRoutes = [
            // 1 — Regular short
            [
                'name'        => 'Cebu to Talisay City',
                'code'        => 'ST-TAL-REG',
                'bus_type'    => 'regular',
                'price'       => 12.00,
                'distance_km' => 8.0,
                'duration'    => 25,
                'start'       => ['Cebu South Bus Terminal', 123.9011, 10.2870],
                'via'         => [
                    ['Talisay City', 123.8444, 10.2453, 8.0],
                ],
            ],
            // 2 — Regular medium
            [
                'name'        => 'Cebu to Naga City',
                'code'        => 'ST-NAG-REG',
                'bus_type'    => 'regular',
                'price'       => 30.00,
                'distance_km' => 25.0,
                'duration'    => 60,
                'start'       => ['Cebu South Bus Terminal', 123.9011, 10.2870],
                'via'         => [
                    ['Talisay City', 123.8444, 10.2453,  8.0],
                    ['Minglanilla',  123.7965, 10.2436, 18.0],
                    ['Naga City',    123.7566, 10.2113, 25.0],
                ],
            ],
            // 3 — Regular medium-long
            [
                'name'        => 'Cebu to Carcar City',
                'code'        => 'ST-CAR-REG',
                'bus_type'    => 'regular',
                'price'       => 42.00,
                'distance_km' => 38.0,
                'duration'    => 75,
                'start'       => ['Cebu South Bus Terminal', 123.9011, 10.2870],
                'via'         => [
                    ['Talisay City', 123.8444, 10.2453,  8.0],
                    ['Minglanilla',  123.7965, 10.2436, 18.0],
                    ['Naga City',    123.7566, 10.2113, 25.0],
                    ['Carcar City',  123.6394, 10.1048, 38.0],
                ],
            ],
            // 4 — Regular long
            [
                'name'        => 'Cebu to Toledo City',
                'code'        => 'ST-TOL-REG',
                'bus_type'    => 'regular',
                'price'       => 60.00,
                'distance_km' => 55.0,
                'duration'    => 90,
                'start'       => ['Cebu South Bus Terminal', 123.9011, 10.2870],
                'via'         => [
                    ['Naga City',    123.7566, 10.2113, 25.0],
                    ['San Fernando', 123.7097, 10.1677, 35.0],
                    ['Toledo City',  123.6385, 10.3763, 55.0],
                ],
            ],
            // 5 — Air-con
            [
                'name'        => 'Cebu to Toledo City (Aircon)',
                'code'        => 'ST-TOL-AC',
                'bus_type'    => 'aircon',
                'price'       => 85.00,
                'distance_km' => 55.0,
                'duration'    => 90,
                'start'       => ['Cebu South Bus Terminal', 123.9011, 10.2870],
                'via'         => [
                    ['Naga City',   123.7566, 10.2113, 25.0],
                    ['Toledo City', 123.6385, 10.3763, 55.0],
                ],
            ],
        ];

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
