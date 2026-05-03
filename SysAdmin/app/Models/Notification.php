<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = [
        'type',
        'message',
        'sender_id',
        'recipient_id',
        'driver_id',
        'schedule_id',
        'bus_id',
        'route_approval_request_id',
        'is_read',
        'read_at',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'read_at' => 'datetime',
    ];
}
