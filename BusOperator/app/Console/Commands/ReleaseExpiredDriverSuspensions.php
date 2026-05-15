<?php

namespace App\Console\Commands;

use App\Models\Driver;
use Carbon\Carbon;
use Illuminate\Console\Command;

class ReleaseExpiredDriverSuspensions extends Command
{
    protected $signature = 'drivers:release-expired-suspensions';

    protected $description = 'Set suspended drivers back to active when suspended_until has passed and notify them';

    public function handle(): int
    {
        $now = Carbon::now();
        $count = 0;

        Driver::query()
            ->where('status', 'suspended')
            ->whereNotNull('suspended_until')
            ->where('suspended_until', '<=', $now)
            ->cursor()
            ->each(function (Driver $driver) use (&$count) {
                if ($driver->liftSuspensionIfExpired()) {
                    $count++;
                    $this->line("Reactivated driver #{$driver->id} ({$driver->name})");
                }
            });

        if ($count === 0) {
            $this->info('No expired suspensions to lift.');
        }

        return self::SUCCESS;
    }
}
