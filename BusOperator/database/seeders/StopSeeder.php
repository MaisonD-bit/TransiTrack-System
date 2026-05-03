<?php

namespace Database\Seeders;

use App\Models\Stop;
use Illuminate\Database\Seeder;

class StopSeeder extends Seeder
{
    public function run()
    {
        Stop::create([
            'name' => 'North Bus Terminal',
            'latitude' => 10.3311,
            'longitude' => 123.9177,
            'description' => 'Cebu North Bus Terminal'
        ]);

        Stop::create([
            'name' => 'SM City Cebu',
            'latitude' => 10.3119,
            'longitude' => 123.9158,
            'description' => 'SM City Cebu Bus Stop'
        ]);

        Stop::create([
            'name' => 'Cebu Capitol',
            'latitude' => 10.3172,
            'longitude' => 123.8914,
            'description' => 'Cebu Provincial Capitol'
        ]);

        Stop::create([
            'name' => 'South Bus Terminal',
            'latitude' => 10.2933,
            'longitude' => 123.8844,
            'description' => 'Cebu South Bus Terminal'
        ]);
    }
}