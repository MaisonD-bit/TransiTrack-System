<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run()
    {
        User::create([
            'name' => 'John Driver',
            'email' => 'driver@example.com',
            'password' => Hash::make('password'),
            'role' => 'driver'
        ]);

        User::create([
            'name' => 'Mike Driver',
            'email' => 'mike@example.com',
            'password' => Hash::make('password'),
            'role' => 'driver'
        ]);

        User::create([
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => Hash::make('password'),
            'role' => 'admin'
        ]);
    }
}