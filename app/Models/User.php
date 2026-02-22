<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use GetStream\StreamChat\Client as StreamChat;

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
        'first_name',
        'last_name',
        'email',
        'password',
        'contact_number',
        'gender',
        'role',
        'terminal',
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
     * Get the user's full name.
     *
     * @return string
     */
    public function getNameAttribute()
    {
        return $this->first_name . ' ' . $this->last_name;
    }

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

    /**
     * Get the formatted role name with spaces
     */
    public function getFormattedRoleAttribute()
    {
        return match($this->role) {
            'northBusManager' => 'North Bus Manager',
            'southBusManager' => 'South Bus Manager',
            default => ucfirst($this->role)
        };
    }

    /**
     * Generate a Stream Chat token for the user
     */
    public function getStreamToken() : string
    {
        $client = new StreamChat(
            env('STREAM_API_KEY'),
            env('STREAM_API_SECRET')
        );

        return $client->createToken((string)$this->id);
    }

    /**
     * Get Stream user data
     */
    public function getStreamUserData(): array
    {
        // Map your app roles to Stream Chat roles
        $streamRole = match($this->role) {
            'admin', 'northBusManager', 'southBusManager' => 'admin',
            'operator' => 'operator',
            'driver' => 'driver',
            default => 'user',
        };

        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'role' => $streamRole,
            'image' => $this->photo_url ?? null,
        ];
    }

}