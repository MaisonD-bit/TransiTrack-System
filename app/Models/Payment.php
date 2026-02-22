<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'reference',
        'payment_id',
        'method',
        'amount',
        'currency',
        'status',
        'payload'
    ];

    protected $casts = [
        'payload' => 'array'
    ];
}