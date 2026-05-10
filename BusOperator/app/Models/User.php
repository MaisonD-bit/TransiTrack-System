<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use GetStream\StreamChat\Client as StreamChat;

class User extends Authenticatable
{
    use Notifiable;

    protected $fillable = [
        'name',
        'first_name', 
        'middle_initial', 
        'last_name', 
        'email',
        'password',
        'role',
        'terminal', 
        'contact_number',
        'company_name',
        'company_address',
        'company_contact',
        'company_email',
        'fleet_size',
        'routes_served',
        'photo_url',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    public function getFullNameAttribute()
    {
        $middle = $this->middle_initial ? ' ' . $this->middle_initial . '.' : '';
        return $this->first_name . $middle . ' ' . $this->last_name;
    }

    protected static function boot()
    {
        parent::boot();
        
        static::saving(function ($user) {
            if ($user->first_name && $user->last_name) {
                $middle = $user->middle_initial ? ' ' . $user->middle_initial . '.' : '';
                $user->name = $user->first_name . $middle . ' ' . $user->last_name;
            }
        });
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
        $streamRole = match ($this->role) {
            'admin', 'northBusManager', 'southBusManager' => 'admin',
            'bus_operator' => 'user',
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