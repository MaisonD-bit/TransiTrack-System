<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;


class Space extends Model
{
    protected $primaryKey = 'space_id';
    // If your primary key is not auto-incrementing or not an integer, you may also need:
    // public $incrementing = true;
    // protected $keyType = 'int';
    protected $table = 'spaces';
    protected $fillable = [
        'location', 
        'is_occupied'
    ];

    public function busSchedules()
    {
        return $this->hasMany(Schedule::class, 'space_id', 'space_id');
    }
}
