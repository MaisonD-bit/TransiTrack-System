<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Bus extends Model
{
    protected $primaryKey = 'bus_id';
    protected $table = 'buses';
    protected $fillable = [
        'plate_number',
        'company',
        'type',
        'status',
        'rental_status',
        'capacity',
    ];

    public function busSchedules()
    {
        return $this->hasMany(BusSchedule::class, 'bus_id', 'bus_id');
    }
}
