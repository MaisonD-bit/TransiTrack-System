<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notifiable;

/** Bus operator account in shared `users` table (read-only for TM). */
class OperatorUser extends Model
{
    use Notifiable;

    protected $table = 'users';

    protected $guarded = [];
}
