<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;

class Schedule extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'route_id',
        'bus_id',
        'driver_id',
        'date',
        'days',
        'start_time',
        'end_time',
        'status',
        'notes',
        'actual_stops'
    ];

    protected $casts = [
        'date' => 'date',
        'days' => 'array',
        'actual_stops' => 'array'
    ];

    public function route()
    {
        return $this->belongsTo(Route::class);
    }

    public function bus()
    {
        return $this->belongsTo(Bus::class);
    }

    public function driver()
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    /**
     * Update schedule statuses based on current time
     * This resolves the "Call to undefined method" error
     */
    public static function updateStatuses()
    {
        $now = Carbon::now();
        $today = $now->format('Y-m-d');
        $currentTime = $now->format('H:i:s');
        
        // Update scheduled to active
        self::where('status', 'scheduled')
            ->where('date', $today)
            ->where('start_time', '<=', $currentTime)
            ->where('end_time', '>=', $currentTime)
            ->update([
                'status' => 'active',
                'updated_at' => now()
            ]);
        
        // Update active to completed
        self::where('status', 'active')
            ->where('date', $today)
            ->where('end_time', '<', $currentTime)
            ->update([
                'status' => 'completed',
                'updated_at' => now()
            ]);
    }
}