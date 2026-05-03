<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Route;
use App\Models\Stop;
use Illuminate\Support\Facades\DB;

class RouteSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // First, disable foreign key checks and delete existing routes
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        DB::table('route_stops')->truncate(); // Remove existing route-stop relationships
        DB::table('routes')->truncate();      // Remove existing routes
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        
        // Rest of your seeder code remains the same
        // Create stops for the routes
        $cebuNorthBusTerminal = Stop::firstOrCreate(
            ['name' => 'Cebu North Bus Terminal'],
            [
                'latitude' => 10.3156,
                'longitude' => 123.9172,
                'description' => 'Main terminal for northbound buses (SM City)',
                'status' => 'active'
            ]
        );

        // Other necessary stops
        $stops = [
            ['Sogod', 10.7292, 124.0014, 'Sogod Town Center'],
            ['Borbon', 10.8347, 124.0271, 'Borbon Town Center'],
            ['Tabogon', 10.9569, 123.9978, 'Tabogon Town Center'],
            ['Tabuelan', 10.8687, 123.9478, 'Tabuelan Town Center'],
            ['Tuburan', 10.7303, 123.8291, 'Tuburan Town Center'],
            ['Maravilla', 10.7893, 123.9296, 'Maravilla Junction'],
            ['Daan Bantayan', 11.2766, 124.0552, 'Daanbantayan Town Center'],
            ['Maya', 11.3181, 124.0122, 'Maya Port for Malapascua Island'],
            ['Bagay', 11.0500, 123.9700, 'Bagay Area'],
            ['Hagnaya', 11.1223, 123.8244, 'Port for ferry to Bantayan Island'],
            ['Kawit', 10.9971, 123.9421, 'Kawit Junction'],
            ['Vistoria', 11.0800, 123.8500, 'Vistoria Area'],
            ['Mainline', 10.9300, 123.8700, 'Main route junction'],
            ['Bantayan Island', 11.2000, 123.7300, 'Bantayan Island'],
            ['Tacloban', 11.2429, 125.0037, 'Tacloban City'],
            ['Madridejos', 11.2700, 123.7400, 'Madridejos Town'],
            ['San Isidro', 10.8000, 124.0100, 'San Isidro Town'],
            ['Naval', 11.5600, 124.3900, 'Naval Town'],
            ['Bacolod', 10.6713, 122.9511, 'Bacolod City via Don Salvador'],
            ['Bacood', 10.5600, 123.1200, 'Bacood via Canlaon']
        ];

        foreach ($stops as [$name, $lat, $long, $desc]) {
            Stop::firstOrCreate(
                ['name' => $name],
                [
                    'latitude' => $lat,
                    'longitude' => $long,
                    'description' => $desc,
                    'status' => 'active'
                ]
            );
        }

        // Create routes based on the North Bus Terminal Guide
        // JULILA TRANSIT
        $this->createRoute(
            'Cebu to Sogod-Borbon', 
            'JT-SOG-BOR', 
            'Cebu North Bus Terminal',
            'Borbon',
            'Route from Cebu North Bus Terminal to Sogod-Borbon',
            80.00, // regular price
            null,  // no aircon price
            65.0,  // distance
            120,   // duration in minutes
            'JULILA TRANSIT'
        );

        $this->createRoute(
            'Cebu to Tabogon via Tuburan', 
            'JT-TAB-TUB', 
            'Cebu North Bus Terminal',
            'Tabogon',
            'Route from Cebu North Bus Terminal to Tabogon via Tuburan',
            90.00, // regular price
            null,  // no aircon price
            75.0,  // distance
            150,   // duration in minutes
            'JULILA TRANSIT'
        );

        // INDAY MEMIE BUS
        $this->createRoute(
            'Cebu to Tabuelan via Maravilla', 
            'IMB-TAB-MAR', 
            'Cebu North Bus Terminal',
            'Tabuelan',
            'Route from Cebu North Bus Terminal to Tabuelan via Maravilla',
            85.00, // regular price
            null,  // no aircon price
            70.0,  // distance
            140,   // duration in minutes
            'INDAY MEMIE BUS'
        );

        // CEBU SAN SEBASTIAN LINER CORP.
        $this->createRoute(
            'Cebu to Sogod via Borbon', 
            'CSS-SOG-BOR', 
            'Cebu North Bus Terminal',
            'Sogod',
            'Route from Cebu North Bus Terminal to Sogod via Borbon',
            80.00, // regular price
            null,  // no aircon price
            65.0,  // distance
            120,   // duration in minutes
            'CEBU SAN SEBASTIAN LINER CORP.'
        );

        $this->createRoute(
            'Cebu to Tabogon', 
            'CSS-TAB', 
            'Cebu North Bus Terminal',
            'Tabogon',
            'Route from Cebu North Bus Terminal to Tabogon',
            90.00, // regular price
            null,  // no aircon price
            75.0,  // distance
            140,   // duration in minutes
            'CEBU SAN SEBASTIAN LINER CORP.'
        );

        // ROUGH RIDERS / WHITE STALLION
        $this->createRoute(
            'Cebu to Daan Bantayan Maya', 
            'RR-MAYA', 
            'Cebu North Bus Terminal',
            'Maya',
            'Route from Cebu North Bus Terminal to Daan Bantayan Maya',
            150.00, // regular price
            null,   // no aircon price
            135.0,  // distance
            220,    // duration in minutes
            'ROUGH RIDERS / WHITE STALLION'
        );

        // METRO CEBU AUTOBUS
        $this->createRoute(
            'Cebu to Bagay via Hagnaya', 
            'MCA-BAG-HAG', 
            'Cebu North Bus Terminal',
            'Bagay',
            'Route from Cebu North Bus Terminal to Bagay via Hagnaya',
            130.00, // regular price
            null,   // no aircon price
            110.0,  // distance
            180,    // duration in minutes
            'METRO CEBU AUTOBUS'
        );

        $this->createRoute(
            'Cebu to Bagay', 
            'MCA-BAG', 
            'Cebu North Bus Terminal',
            'Bagay',
            'Direct route from Cebu North Bus Terminal to Bagay',
            120.00, // regular price
            null,   // no aircon price
            100.0,  // distance
            160,    // duration in minutes
            'METRO CEBU AUTOBUS'
        );

        $this->createRoute(
            'Cebu to Kawit', 
            'MCA-KAW', 
            'Cebu North Bus Terminal',
            'Kawit',
            'Route from Cebu North Bus Terminal to Kawit',
            110.00, // regular price
            null,   // no aircon price
            90.0,   // distance
            150,    // duration in minutes
            'METRO CEBU AUTOBUS'
        );

        $this->createRoute(
            'Cebu to Vistoria via Hagnaya', 
            'MCA-VIS-HAG', 
            'Cebu North Bus Terminal',
            'Vistoria',
            'Route from Cebu North Bus Terminal to Vistoria via Hagnaya',
            140.00, // regular price
            180.00, // aircon price
            120.0,  // distance
            190,    // duration in minutes
            'METRO CEBU AUTOBUS'
        );

        // ISLAND AUTOBUS
        $this->createRoute(
            'Cebu to Mainline', 
            'IA-MAIN', 
            'Cebu North Bus Terminal',
            'Mainline',
            'Route from Cebu North Bus Terminal to Mainline',
            100.00, // regular price
            null,   // no aircon price
            85.0,   // distance
            140,    // duration in minutes
            'ISLAND AUTOBUS'
        );

        $this->createRoute(
            'Cebu to Hagnaya', 
            'IA-HAG', 
            'Cebu North Bus Terminal',
            'Hagnaya',
            'Route from Cebu North Bus Terminal to Hagnaya Port',
            120.00, // regular price
            null,   // no aircon price
            100.0,  // distance
            160,    // duration in minutes
            'ISLAND AUTOBUS'
        );

        // CERES routes
        $ceresRoutes = [
            ['Tacloban', 'TAC', null, 280.0, 420],
            ['Bantayan Island', 'BAN', null, 150.0, 240],
            ['Madridejos', 'MAD', 'AIRCON', 145.0, 230],
            ['San Isidro', 'SAN', null, 70.0, 130],
            ['Naval', 'NAV', null, 170.0, 260],
            ['Hagnaya', 'HAG', null, 100.0, 160],
            ['Maya via Bagay', 'MYB', 'NON AIRCON', 135.0, 220],
            ['Maya via Kawit', 'MYK', 'NON AIRCON', 135.0, 220], // Fixed code here
            ['Daan Bantayan via Kawit', 'DBK', 'NON AIRCON', 120.0, 200],
            ['Tabogon', 'TAB', 'NON AIRCON', 75.0, 140],
            ['Tuburan', 'TUB', 'NON AIRCON', 65.0, 130],
            ['Bacolod via Don Salvador', 'BDS', 'AIRCON', 320.0, 480],
            ['Bacood via Canlaon', 'BVC', 'AIRCON', 270.0, 420],
        ];

        foreach ($ceresRoutes as $index => [$destination, $code, $accomType, $distance, $duration]) {
            $isAircon = ($accomType === 'AIRCON');
            $basePrice = 70.00 + ($index * 15);
            $airconPrice = $isAircon ? $basePrice * 1.25 : null;
            $regularPrice = ($accomType === 'NON AIRCON' || $accomType === null) ? $basePrice : null;

            $this->createRoute(
                'Cebu to ' . $destination,
                'CERES-' . $code,
                'Cebu North Bus Terminal',
                $destination,
                'Route from Cebu North Bus Terminal to ' . $destination,
                $regularPrice ?? $basePrice,
                $airconPrice,
                $distance,
                $duration,
                'CERES'
            );
        }
    }

    /**
     * Helper method to create a route
     */
    private function createRoute($name, $code, $start, $end, $description, $regularPrice, $airconPrice, $distance, $duration, $busCompany)
    {
        // Get start and end coordinates from stops
        $startStop = Stop::where('name', $start)->first();
        $endStop = Stop::where('name', $end)->first();

        $geometry = null;
        if ($startStop && $endStop) {
            $mapboxToken = env('MAPBOX_TOKEN', 'your-mapbox-token');
            $url = "https://api.mapbox.com/directions/v5/mapbox/driving/{$startStop->longitude},{$startStop->latitude};{$endStop->longitude},{$endStop->latitude}?geometries=geojson&access_token={$mapboxToken}";
            $response = @file_get_contents($url);
            if ($response) {
                $data = json_decode($response, true);
                if (isset($data['routes'][0]['geometry'])) {
                    $geometry = json_encode($data['routes'][0]['geometry']);
                }
            }
        }

        return Route::create([
            'name' => $name,
            'code' => $code,
            'start_location' => $start,
            'end_location' => $end,
            'description' => $description . ' operated by ' . $busCompany,
            'regular_price' => $regularPrice,
            'aircon_price' => $airconPrice,
            'distance_km' => $distance,
            'estimated_duration' => $duration,
            'status' => 'active',
            'geometry' => json_encode([
                'type' => 'LineString',
                'coordinates' => [
                    [$startStop ? $startStop->longitude : null, $startStop ? $startStop->latitude : null],
                    [$endStop ? $endStop->longitude : null, $endStop ? $endStop->latitude : null]
                ]
            ]),
        ]);
    }
}