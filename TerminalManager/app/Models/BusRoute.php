<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Shared `routes` table from BusOperator (read-only for TM). */
class BusRoute extends Model
{
    protected $table = 'routes';

    protected $guarded = [];
}
