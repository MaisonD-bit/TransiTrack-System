<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Feedback extends Model
{
    protected $table = 'feedbacks';

    protected $fillable = [
        'commuter_id',
        'driver_id',
        'schedule_id',
        'public_ticket_id',
        'driver_rating',
        'service_rating',
        'cleanliness_rating',
        'safety_rating',
        'overall_rating',
        'comment',
    ];

    protected $casts = [
        'driver_rating'      => 'integer',
        'service_rating'     => 'integer',
        'cleanliness_rating' => 'integer',
        'safety_rating'      => 'integer',
        'overall_rating'     => 'float',
    ];

    public function commuter()
    {
        return $this->belongsTo(Commuter::class);
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function schedule()
    {
        return $this->belongsTo(Schedule::class);
    }
}
