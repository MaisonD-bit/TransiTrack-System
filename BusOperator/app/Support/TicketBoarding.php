<?php

namespace App\Support;

use Illuminate\Support\Collection;

/**
 * Current “on board” count: one seat per logged-in commuter (multiple paid tickets still count once
 * until they alight), each guest ticket counts one, capped by bus capacity. Revenue uses all rows.
 */
final class TicketBoarding
{
    /**
     * @param  Collection<int, \App\Models\Ticket>  $tickets
     */
    public static function aboardCount(Collection $tickets, int $capacity): int
    {
        $active = $tickets->filter(fn ($t) => $t->alighted_at === null);
        $guestSeats = $active->whereNull('commuter_id')->count();
        $commuterSeats = $active->whereNotNull('commuter_id')->pluck('commuter_id')->unique()->count();
        $raw = $guestSeats + $commuterSeats;
        if ($capacity > 0) {
            return min($raw, $capacity);
        }

        return $raw;
    }
}
