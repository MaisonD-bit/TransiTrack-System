<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Driver extends Model
{
    protected $primaryKey = 'driver_id';
    protected $table = 'drivers';
    protected $fillable = [
        'name',
        'license_number',
        'contact_info',
    ];

    public function busSchedules()
    {
        return $this->hasMany(BusSchedule::class, 'driver_id', 'driver_id');
    }
}
