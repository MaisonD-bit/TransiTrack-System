<?php

namespace Database\Seeders;

use App\Models\SysadminUser;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SysadminSeeder extends Seeder
{
    public function run(): void
    {
        SysadminUser::query()->updateOrCreate(
            ['email' => 'admin@email.com'],
            [
                'name' => 'TransiTrack Sysadmin',
                'password' => Hash::make('sysadmin'),
            ]
        );
    }
}
