<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    use HasFactory;

    protected $fillable = [
        'sender_id',
        'recipient_id',
        'recipient_type',
        'subject',
        'body',
    ];

    public function sender()
    {
        return $this->belongsTo(OperatorUser::class, 'sender_id');
    }

    public function recipient()
    {
        return $this->belongsTo(OperatorUser::class, 'recipient_id');
    }
}
