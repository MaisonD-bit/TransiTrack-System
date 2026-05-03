<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Route extends Model
{
    protected $table = 'routes';

    protected $fillable = [
        'name',
        'code',
    ];
}
