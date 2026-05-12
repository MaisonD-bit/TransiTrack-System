<?php

namespace App\Console\Commands;

use App\Models\Driver;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ReleaseExpiredDriverSuspensions extends Command
{
    protected $signature = 'drivers:release-expired-suspensions';

    protected $description = 'Set suspended drivers back to active when suspension period ends and notify them';

    public function handle(): int
    {
        $count = 0;
        $query = Driver::query()
            ->where('status', 'suspended')
            ->whereNotNull('suspended_until')
            ->where('suspended_until', '<=', now());

        foreach ($query->cursor() as $driver) {
            if ($driver->releaseSuspensionIfDue()) {
                $count++;
            }
        }

        if ($count > 0) {
            Log::info("Released {$count} driver suspension(s).");
            $this->info("Released {$count} driver suspension(s).");
        }

        return self::SUCCESS;
    }
}
