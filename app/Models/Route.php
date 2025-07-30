<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Route extends Model
{
    protected $primaryKey = 'route_id';
    protected $table = 'routes';
    protected $fillable = [
        'name',
        'start_location',
        'end_location',
        'distance',
        'duration',
    ];

    public function busSchedules()
    {
        return $this->hasMany(BusSchedule::class, 'route_id', 'route_id');
    }
}
