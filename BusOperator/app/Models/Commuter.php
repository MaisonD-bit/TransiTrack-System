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
     * Prefer first + last when those columns exist; otherwise the legacy `name` field.
     */
    public function getDisplayNameAttribute(): string
    {
        $first = isset($this->attributes['first_name']) ? trim((string) $this->attributes['first_name']) : '';
        $last = isset($this->attributes['last_name']) ? trim((string) $this->attributes['last_name']) : '';
        $split = trim($first.' '.$last);
        if ($split !== '') {
            return $split;
        }

        $name = isset($this->attributes['name']) ? trim((string) $this->attributes['name']) : '';

        return $name !== '' ? $name : 'Commuter';
    }
}