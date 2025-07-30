<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Space extends Model
{   
    protected $primaryKey = 'space_id';
    protected $table = 'spaces';
    protected $fillable = [
        'location', 
        'is_occupied'
    ];

    public function busSchedules()
    {
        return $this->hasMany(BusSchedule::class, 'space_id', 'space_id');
    }
}
