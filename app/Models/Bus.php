<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Bus extends Model
{
    protected $table = 'buses';
    protected $fillable = [
        'plate_number',
        'company',
        'type',
        'status',
        'rental_status',
        'capacity',
    ];
}
