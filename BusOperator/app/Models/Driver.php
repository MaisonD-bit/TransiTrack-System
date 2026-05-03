<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Facades\Hash;

class Driver extends Authenticatable
{
    protected $fillable = [
        'name',
        'email',
        'password', 
        'contact_number',
        'date_of_birth',
        'gender',
        'address',
        'license_number',
        'license_expiry',
        'emergency_name',
        'emergency_relation',
        'emergency_contact',
        'status',
        'notes',
        'photo_url',
        'app_registered', 
        'user_id',
    ];

    protected $hidden = [
        'password',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'license_expiry' => 'date',
        'app_registered' => 'boolean',
    ];

    protected $attributes = [
        'status' => 'active',
        'app_registered' => false,
    ];

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    public function routes()
    {
        return $this->belongsToMany(Route::class, 'schedules');
    }

    // public function setPasswordAttribute($value)
    // {
    //     $this->attributes['password'] = Hash::make($value);
    // }

    public function company()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}