<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use GetStream\StreamChat\Client as StreamChat;

class User extends Authenticatable
{
    use HasFactory, Notifiable;
    protected $table = 'managers';

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
        if ($this->role === 'terminalManager') {
            return match ($this->terminal) {
                'north' => 'North Bus Terminal Manager',
                'south' => 'South Bus Terminal Manager',
                default => 'Bus Terminal Manager',
            };
        }

        return match ($this->role) {
            'northBusManager' => 'North Bus Manager',
            'southBusManager' => 'South Bus Manager',
            default => ucfirst($this->role)
        };
    }

    /**
     * Generate a Stream Chat token for the user
     */
    /**
     * Stream user id (must not collide with bus_operator ids from `users` table).
     */
    public function streamUserId(): string
    {
        return 'tm_'.$this->getKey();
    }

    public function getStreamToken(): string
    {
        $key = (string) config('services.stream_chat.api_key', '');
        $secret = (string) config('services.stream_chat.api_secret', '');

        if ($key === '' || $secret === '') {
            throw new \RuntimeException('Stream Chat is not configured (STREAM_API_KEY / STREAM_API_SECRET).');
        }

        $client = new StreamChat($key, $secret);

        return $client->createToken($this->streamUserId());
    }

    /**
     * Public URL for Stream avatar (Stream rejects relative storage paths).
     */
    public function streamAvatarUrl(): ?string
    {
        $path = $this->photo_url;
        if (! $path) {
            return null;
        }
        $path = trim((string) $path);
        if ($path === '') {
            return null;
        }
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return rtrim((string) config('app.url'), '/').'/storage/'.ltrim($path, '/');
    }

    /**
     * Get Stream user data
     */
    public function getStreamUserData(): array
    {
        // Map your app roles to Stream Chat roles
        $streamRole = match ($this->role) {
            'admin', 'northBusManager', 'southBusManager', 'terminalManager' => 'admin',
            'bus_operator' => 'user',
            'driver' => 'driver',
            default => 'user',
        };

        return [
            'id' => $this->streamUserId(),
            'name' => $this->name,
            'role' => $streamRole,
            'image' => $this->streamAvatarUrl(),
        ];
    }
}
