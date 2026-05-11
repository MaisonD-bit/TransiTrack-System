<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class Schedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'driver_id',
        'route_id',
        'bus_id',
        'date',
        'start_time',
        'end_time',
        'ends_next_day',
        'status',
        'fare_regular',
        'fare_aircon',
        'terminal_space',
        'actual_stops',
        'customer_name',
        'contact_number',
        'passengers',
        'accepted_at',
        'declined_at',
        'started_at',
        'completed_at',
        'current_lat',
        'current_lng',
        'cancel_reason',
        'cancellation_status',
    ];

    protected $casts = [
        'date' => 'date',
        'start_time' => 'datetime:H:i',
        'end_time' => 'datetime:H:i',
        'fare_regular' => 'decimal:2',
        'fare_aircon' => 'decimal:2',
        'actual_stops' => 'array',
        'passengers' => 'integer',
        'ends_next_day' => 'boolean',
        'accepted_at' => 'datetime',
        'declined_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'current_lat' => 'float',
        'current_lng' => 'float',
    ];

    // Relationships
    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function route()
    {
        return $this->belongsTo(Route::class);
    }

    public function bus()
    {
        return $this->belongsTo(Bus::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }

    public function scopeToday($query)
    {
        return $query->whereDate('date', Carbon::today());
    }

    public function scopeUpcoming($query)
    {
        return $query->whereDate('date', '>=', Carbon::today());
    }

    public function scopeForDriver($query, $driverId)
    {
        return $query->where('driver_id', $driverId);
    }

    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Real trip window: start at date + start_time; end at date + end_time, or +1 day if ends_next_day.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public function windowBounds(): array
    {
        $d = $this->date instanceof \Carbon\CarbonInterface
            ? $this->date->format('Y-m-d')
            : Carbon::parse((string) $this->date)->format('Y-m-d');
        $st = $this->start_time instanceof \Carbon\CarbonInterface
            ? $this->start_time->format('H:i')
            : Carbon::parse((string) $this->start_time)->format('H:i');
        $en = $this->end_time instanceof \Carbon\CarbonInterface
            ? $this->end_time->format('H:i')
            : Carbon::parse((string) $this->end_time)->format('H:i');

        $start = Carbon::parse("{$d} {$st}");
        $end = Carbon::parse("{$d} {$en}");
        if ($this->ends_next_day) {
            $end->addDay();
        }

        return [$start, $end];
    }

    // Accessors
    public function getFormattedDateAttribute()
    {
        return $this->date->format('M d, Y');
    }

    public function getFormattedStartTimeAttribute()
    {
        return Carbon::parse($this->start_time)->format('g:i A');
    }

    public function getFormattedEndTimeAttribute()
    {
        return Carbon::parse($this->end_time)->format('g:i A');
    }
}