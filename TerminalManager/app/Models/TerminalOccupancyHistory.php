<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TerminalOccupancyHistory extends Model
{
    protected $table = 'terminal_occupancy_history';

    protected $fillable = [
        'space_id',
        'action',
        'driver_id',
        'driver_name',
        'driver_contact',
        'company_id',
        'company_name',
        'company_contact',
        'route_name',
        'accommodation_type',
        'duration_minutes',
        'time_occupied',
        'time_available_again',
        'time_released',
        'reason_for_cancellation',
        'edit_notes',
        'additional_notes',
        'performed_by'
    ];

    protected $casts = [
        'time_occupied' => 'datetime',
        'time_available_again' => 'datetime',
        'time_released' => 'datetime',
    ];

    // Relationships
    public function space()
    {
        return $this->belongsTo(TerminalSpace::class, 'space_id', 'space_id');
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }

    public function company()
    {
        return $this->belongsTo(User::class, 'company_id');
    }
}