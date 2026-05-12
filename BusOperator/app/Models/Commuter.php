<?php
// app/Models/Commuter.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable; // Change to Authenticatable
use Illuminate\Notifications\Notifiable;

class Commuter extends Authenticatable // Extend Authenticatable
{
    use HasFactory, Notifiable; // Add traits

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'first_name',
        'middle_name',
        'last_name',
        'email',
        'address',
        'contact_number',
        'gender',
        'photo_url',
        'passenger_type',
        'status',
        'password',
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
        'password' => 'hashed', // Ensure passwords are hashed correctly
    ];

    /**
     * Full name for UI/API. Uses first_name + last_name when those columns exist and are set;
     * otherwise falls back to `name` (base commuters table).
     */
    public function displayName(): string
    {
        $fn = isset($this->attributes['first_name']) ? trim((string) $this->attributes['first_name']) : '';
        $ln = isset($this->attributes['last_name']) ? trim((string) $this->attributes['last_name']) : '';
        $fromParts = trim($fn . ' ' . $ln);

        return $fromParts !== '' ? $fromParts : trim((string) ($this->attributes['name'] ?? ''));
    }
}