<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Ticket extends Model
{
    protected $fillable = [
        'public_ticket_id',
        'schedule_id',
        'alight_stop_index',
        'alight_is_destination',
        'fare',
        'commuter_id',
        'payment_method',
        'payment_status',
        'payment_ref',
        'paid_at',
        'qr_payload',
        'alighted_at',
    ];

    protected $casts = [
        'fare' => 'decimal:2',
        'paid_at' => 'datetime',
        'alight_is_destination' => 'boolean',
        'alighted_at' => 'datetime',
    ];

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }

    public function commuter(): BelongsTo
    {
        return $this->belongsTo(Commuter::class);
    }
}
