<?php

namespace Database\Seeders;

use App\Models\SysadminUser;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        SysadminUser::query()->updateOrCreate(
            ['email' => 'admin@transitrack.com'],
            [
                'name' => 'Admin',
                'password' => bcrypt('12345678'),
            ]
        );
    }
}
