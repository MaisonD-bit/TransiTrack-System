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
        'operator_response',
    ];

    public function commuter()
    {
        return $this->belongsTo(\App\Models\Commuter::class);
    }
}
