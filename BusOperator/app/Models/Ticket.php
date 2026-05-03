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
    ];

    protected $casts = [
        'fare' => 'decimal:2',
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
