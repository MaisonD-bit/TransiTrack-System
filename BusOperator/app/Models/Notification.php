<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'message',
        'sender_id',
        'recipient_id',
        'driver_id',
        'schedule_id',
        'bus_id',
        'route_approval_request_id',
        'latitude',
        'longitude',
        'location_label',
        'incident_type',
        'is_read',
        'read_at',
    ];

    protected $casts = [
        'sender_id' => 'integer',
        'latitude' => 'float',
        'longitude' => 'float',
        'is_read' => 'boolean',
        'read_at' => 'datetime',
    ];

    // Relationships
    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function schedule()
    {
        return $this->belongsTo(Schedule::class);
    }

    public function bus()
    {
        return $this->belongsTo(Bus::class);
    }

    public function routeApprovalRequest()
    {
        return $this->belongsTo(RouteApprovalRequest::class);
    }

    public function getSenderNameAttribute()
    {
        if ($this->sender) {
            return $this->sender->name;
        } elseif ($this->driver) {
            return $this->driver->name;
        }
        return 'System';
    }
}