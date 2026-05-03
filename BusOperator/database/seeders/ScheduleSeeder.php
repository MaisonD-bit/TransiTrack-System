<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Schedule;
use App\Models\Driver;
use App\Models\Bus;
use App\Models\Route;

class ScheduleSeeder extends Seeder
{
    public function run(): void
    {
        $driver = Driver::first();
        $bus = Bus::first();
        $route = Route::first();

        if ($driver && $bus && $route) {
            Schedule::create([
                'route_id' => $route->id,
                'bus_id' => $bus->id,
                'driver_id' => $driver->id,
                'date' => now()->toDateString(),
                'start_time' => '08:00',
                'end_time' => '10:00',
                'status' => 'scheduled',
                'fare_regular' => 100,
                'fare_aircon' => 120,
                'terminal_space' => 'A1',
                'notes' => 'Seeded schedule',
                'actual_stops' => json_encode([]),
                'customer_name' => 'John Doe',
                'contact_number' => '09123456789',
                'passengers' => 30,
            ]);
        }
    }
}