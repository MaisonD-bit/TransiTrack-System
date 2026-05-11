<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BoardingRequest extends Model
{
    protected $fillable = [
        'schedule_id', 'route_id', 'from_stop_index',
        'boarding_lng', 'boarding_lat', 'boarding_stop_name',
        'commuter_id', 'commuter_name', 'commuter_email', 'status',
    ];
}
