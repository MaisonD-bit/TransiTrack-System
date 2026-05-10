<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Bus extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'plate_number',
        'bus_number',
        'model',
        'capacity',
        'bus_company',
        'accommodation_type',
        'status',
        'terminal', 
        'description'
    ];

    protected $casts = [
        'capacity' => 'integer',
    ];

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    public function routes()
    {
        return $this->belongsToMany(Route::class, 'bus_routes');
    }

    public function activeSchedules()
    {
        return $this->hasMany(Schedule::class)->where('status', 'active');
    }
}