<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Route extends Model
{
    protected $table = 'routes';

    protected $fillable = [
        'name',
        'code',
        'start_location',
        'end_location',
        'start_coordinates',
        'end_coordinates',
        'distance_km',
        'estimated_duration',
        'description',
        'regular_price',
        'aircon_price',
        'route_fare',
        'bus_type',
        'status',
        'geometry',
        'return_geometry',
        'stops_data',
        'return_stops_data',
        'user_id',
        'terminal',
    ];

    protected $casts = [
        'regular_price' => 'decimal:2',
        'aircon_price' => 'decimal:2',
        'distance_km' => 'decimal:2',
        'estimated_duration' => 'integer',
        'stops_data' => 'array',
        'return_stops_data' => 'array',
        'route_fare' => 'decimal:2',
    ];
}
