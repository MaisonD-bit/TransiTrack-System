<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

trait ManagerTerminalScope
{
    protected function managerTerminal(): ?string
    {
        $user = Auth::user();
        if (! $user) {
            return null;
        }

        if (! empty($user->terminal)) {
            return (string) $user->terminal;
        }

        return match ($user->role ?? '') {
            'northBusManager' => 'north',
            'southBusManager' => 'south',
            default => null,
        };
    }

    protected function isNorthTerminal(?string $terminal = null): bool
    {
        $terminal ??= $this->managerTerminal();

        return $terminal === 'north';
    }

    protected function isSouthTerminal(?string $terminal = null): bool
    {
        $terminal ??= $this->managerTerminal();

        return $terminal === 'south';
    }

    /**
     * @param  Builder<\Illuminate\Database\Eloquent\Model>  $query
     */
    protected function scopeSchedulesByTerminal(Builder $query, string $busRelation = 'bus'): Builder
    {
        $terminal = $this->managerTerminal();
        if ($terminal) {
            $query->whereHas($busRelation, fn ($q) => $q->where('terminal', $terminal));
        }

        return $query;
    }

    /**
     * @param  Builder<\Illuminate\Database\Eloquent\Model>  $query
     */
    protected function scopeBusesByTerminal(Builder $query): Builder
    {
        $terminal = $this->managerTerminal();
        if ($terminal) {
            $query->where('terminal', $terminal);
        }

        return $query;
    }

    /**
     * @param  \Illuminate\Database\Query\Builder  $query
     */
    protected function scopeOperatorsByTerminal($query)
    {
        $terminal = $this->managerTerminal();
        if ($terminal) {
            $query->where('terminal', $terminal);
        }

        return $query;
    }
}
