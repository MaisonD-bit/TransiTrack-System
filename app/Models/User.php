<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'contact_number',
        'gender',
        'role',
        'photo_url',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'date_of_birth' => 'date',
        'license_expiry' => 'date',
    ];

    /**
     * Get the schedules for the driver.
     * This is used for users with the 'driver' role.
     */
    public function schedules()
    {
        return $this->hasMany(Schedule::class, 'driver_id');
    }

    /**
     * Check if the user is a driver
     */
    public function isDriver()
    {
        return $this->role === 'driver';
    }

    /**
     * Get the active schedules for a driver
     */
    public function activeSchedules()
    {
        return $this->schedules()
            ->where('status', 'active')
            ->whereDate('date', today());
    }
}