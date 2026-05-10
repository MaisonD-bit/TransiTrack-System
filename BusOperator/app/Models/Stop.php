<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Stop extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'latitude',
        'longitude',
        'description',
        'status'
    ];

    public function routes()
    {
        return $this->belongsToMany(Route::class, 'route_stops')
            ->withPivot('stop_order', 'estimated_minutes')
            ->withTimestamps();
    }
}