<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RouteApprovalRequest extends Model
{
    protected $fillable = [
        'operator_user_id',
        'terminal',
        'route_ids',
        'stop_configuration',
        'status',
        'submitted_by_operator_at',
        'submitted_by_terminal_at',
        'decided_at',
        'decided_by_sysadmin_id',
        'sysadmin_notes',
        'decline_reason',
    ];

    protected $casts = [
        'route_ids' => 'array',
        'stop_configuration' => 'array',
        'submitted_by_operator_at' => 'datetime',
        'submitted_by_terminal_at' => 'datetime',
        'decided_at' => 'datetime',
    ];

    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_user_id');
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(SysadminUser::class, 'decided_by_sysadmin_id');
    }
}
