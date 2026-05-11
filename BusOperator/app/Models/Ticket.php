<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Ticket extends Model
{
    protected $fillable = [
        'public_ticket_id',
        'schedule_id',
        'fare',
        'commuter_id',
        'qr_payload',
        'payment_method',
        'payment_status',
        'alighted_at',
        'from_stop_index',
    ];

    protected $casts = [
        'fare' => 'decimal:2',
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
