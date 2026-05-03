<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Bus operator account in shared `users` table (read-only for TM). */
class OperatorUser extends Model
{
    protected $table = 'users';

    protected $guarded = [];
}
