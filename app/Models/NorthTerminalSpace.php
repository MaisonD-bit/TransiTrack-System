<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NorthTerminalSpace extends Model
{
    protected $primaryKey = 'space_id';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $table = 'north_terminal_spaces';

    protected $fillable = [
        'space_id',
        'position',
        'position_order',
        'route_name',
        'accommodation_type',
        'is_occupied',
        'occupied_at',
        'available_at',
        'current_driver_id',
        'current_company_id',
        'current_duration_minutes',
        'status',
        'notes'
    ];

    protected $casts = [
        'is_occupied' => 'boolean',
        'occupied_at' => 'datetime',
        'available_at' => 'datetime',
    ];

    // Relationships
    public function currentDriver()
    {
        return $this->belongsTo(Driver::class, 'current_driver_id');
    }

    public function currentCompany()
    {
        return $this->belongsTo(User::class, 'current_company_id');
    }

    public function history()
    {
        return $this->hasMany(TerminalOccupancyHistory::class, 'space_id', 'space_id');
    }
}
