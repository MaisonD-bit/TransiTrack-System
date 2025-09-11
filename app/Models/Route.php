<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Route extends Model
{
    use SoftDeletes;
    
    protected $fillable = [
        'name',
        'code',
        'start_location',
        'end_location',
        'description',
        'regular_price',
        'aircon_price',
        'distance_km',
        'estimated_duration',
        'status'
    ];
    
    protected $casts = [
        'regular_price' => 'float',
        'aircon_price' => 'float',
        'distance_km' => 'float',
        'estimated_duration' => 'integer'
    ];

    
    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }
}