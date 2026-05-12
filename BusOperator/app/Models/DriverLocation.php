<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverLocation extends Model
{
    protected $fillable = [
        'driver_id',
        'schedule_id',
        'latitude',
        'longitude',
        'accuracy_m',
        'speed_mps',
        'heading_deg',
        'recorded_at',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'accuracy_m' => 'float',
        'speed_mps' => 'float',
        'heading_deg' => 'float',
        'recorded_at' => 'datetime',
    ];

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }

    /**
     * Insert a GPS ping unless the last row for this driver is newer than $minIntervalSeconds (rate limit).
     *
     * @return array{recorded: bool, skipped?: bool, location_id?: int}
     */
    public static function recordPing(
        int $driverId,
        ?int $scheduleId,
        float $latitude,
        float $longitude,
        ?float $accuracy_m = null,
        ?float $speed_mps = null,
        ?float $heading_deg = null,
        ?CarbonInterface $recorded_at = null,
        int $minIntervalSeconds = 3
    ): array {
        $now = $recorded_at ?? now();

        $last = static::query()
            ->where('driver_id', $driverId)
            ->orderByDesc('recorded_at')
            ->first();

        if ($last && $last->recorded_at && $last->recorded_at->diffInSeconds($now) < $minIntervalSeconds) {
            return ['recorded' => false, 'skipped' => true];
        }

        $loc = static::create([
            'driver_id' => $driverId,
            'schedule_id' => $scheduleId,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'accuracy_m' => $accuracy_m,
            'speed_mps' => $speed_mps,
            'heading_deg' => $heading_deg,
            'recorded_at' => $now,
        ]);

        return ['recorded' => true, 'location_id' => $loc->id];
    }
}
