<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DriverLocation extends Model
{
    protected $fillable = [
        'driver_id',
        'schedule_id',
        'latitude',
        'longitude',
        'accuracy_m',
        'speed_mps',
        'heading_deg',
        'recorded_at',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'accuracy_m' => 'float',
        'speed_mps' => 'float',
        'heading_deg' => 'float',
        'recorded_at' => 'datetime',
    ];

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function schedule()
    {
        return $this->belongsTo(Schedule::class);
    }
}

