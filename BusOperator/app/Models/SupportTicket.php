<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupportTicket extends Model
{
    protected $fillable = [
        'public_ticket_id',
        'commuter_id',
        'subject',
        'description',
        'category',
        'priority',
        'status',
    ];
}
