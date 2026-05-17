<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

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
        'suspended_until',
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
        'suspended_until' => 'datetime',
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

    /**
     * If suspension end time has passed, reactivate the driver and notify them.
     */
    public function liftSuspensionIfExpired(): bool
    {
        if ($this->status !== 'suspended' || $this->suspended_until === null) {
            return false;
        }
        if (Carbon::parse($this->suspended_until)->gt(now())) {
            return false;
        }

        $this->forceFill([
            'status' => 'active',
            'suspended_until' => null,
        ])->save();

        Notification::create([
            'type' => 'account_update',
            'message' => 'Your suspension period has ended. Your account is active again. Welcome back!',
            'sender_id' => $this->user_id,
            'driver_id' => $this->id,
            'is_read' => false,
        ]);

        return true;
    }
}