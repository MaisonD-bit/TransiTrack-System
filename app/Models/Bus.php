<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Bus extends Model
{
    use SoftDeletes;
    
    protected $fillable = [
        'plate_number',
        'bus_number',
        'model',
        'capacity',
        'bus_company',
        'accommodation_type',
        'status',
        'description'
    ];
    
    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }
    
    public function isAirConditioned()
    {
        return in_array($this->accommodation_type, ['air-conditioned', 'deluxe', 'super-deluxe']);
    }
    
    public function getRoutePrice(Route $route)
    {
        if ($this->isAirConditioned() && !is_null($route->aircon_price)) {
            return $route->aircon_price;
        }
        
        return $route->regular_price;
    }
}