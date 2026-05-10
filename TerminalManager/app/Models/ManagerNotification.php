<?php

namespace App\Models;

use Illuminate\Notifications\DatabaseNotification;

class ManagerNotification extends DatabaseNotification
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'manager_notifications';
}
