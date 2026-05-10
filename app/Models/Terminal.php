<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Terminal extends Model
{
    protected $fillable = [
        'space_id',
        'route_id',
        'driver_id',
        'bus_id',
        'assigned_date',
        'status'
    ];

    protected $casts = [
        'assigned_date' => 'date',
    ];

    /**
     * Get the route associated with this assignment
     */
    public function route(): BelongsTo
    {
        return $this->belongsTo(Route::class);
    }

    /**
     * Get the driver associated with this assignment
     */
    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    /**
     * Get the bus associated with this assignment
     */
    public function bus(): BelongsTo
    {
        return $this->belongsTo(Bus::class);
    }
}