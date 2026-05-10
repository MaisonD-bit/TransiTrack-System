<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run()
    {
        User::updateOrCreate(['email' => 'driver@example.com'], [
            'name' => 'John Driver',
            'first_name' => 'John',
            'last_name' => 'Driver',
            'password' => Hash::make('password'),
            'role' => 'driver'
        ]);

        User::updateOrCreate(['email' => 'mike@example.com'], [
            'name' => 'Mike Driver',
            'first_name' => 'Mike',
            'last_name' => 'Driver',
            'password' => Hash::make('password'),
            'role' => 'driver'
        ]);

        User::updateOrCreate(['email' => 'admin@example.com'], [
            'name' => 'Admin User',
            'first_name' => 'Admin',
            'last_name' => 'User',
            'password' => Hash::make('password'),
            'role' => 'admin'
        ]);
    }
}