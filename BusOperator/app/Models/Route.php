<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Route extends Model
{
    use HasFactory;

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
        'stops_data',
        'user_id',
        'terminal',
    ];

    protected $casts = [
        'regular_price' => 'decimal:2',
        'aircon_price' => 'decimal:2',
        'distance_km' => 'decimal:2',
        'estimated_duration' => 'integer',
        // 'geometry' => 'array',
        'stops_data' => 'array',
        'route_fare' => 'decimal:2',
        'bus_type' => 'string',
    ];

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    public function stops()
    {
        return $this->belongsToMany(Stop::class, 'route_stops', 'route_id', 'stop_id')
            ->withPivot('stop_order', 'estimated_minutes')
            ->orderBy('route_stops.stop_order');
    }

    public function getPathAttribute()
    {
        // Mapbox GeoJSON uses [lng, lat], but many maps expect [lat, lng]
        if (isset($this->geometry['coordinates'])) {
            return collect($this->geometry['coordinates'])
                ->map(fn($coord) => [(float)$coord[1], (float)$coord[0]]) // [lat, lng]
                ->toArray();
        }
        return [];
    }
}