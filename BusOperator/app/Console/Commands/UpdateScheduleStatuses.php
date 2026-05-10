<?php

namespace App\Console\Commands;

use App\Models\Schedule;
use Illuminate\Console\Command;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class UpdateScheduleStatuses extends Command
{
    protected $signature = 'schedule:update-statuses';

    protected $description = 'Update schedule statuses based on current time';

    public function handle()
    {
        $this->info('Updating schedule statuses...');

        try {
            if (! Schema::hasColumn('schedules', 'date')) {
                $this->error('The date column is missing from the schedules table.');
                $this->info('Run: php artisan migrate to add the missing column.');

                return Command::FAILURE;
            }

            $now = Carbon::now();

            $hasEndsNext = Schema::hasColumn('schedules', 'ends_next_day');

            $query = Schedule::query()
                ->whereIn('status', ['scheduled', 'active'])
                ->whereBetween('date', [
                    $now->copy()->subDays(2)->format('Y-m-d'),
                    $now->copy()->addDay()->format('Y-m-d'),
                ]);

            if (Schema::hasColumn('schedules', 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            $updatedToActive = 0;
            $updatedToCompleted = 0;

            foreach ($query->cursor() as $schedule) {
                if (! $hasEndsNext) {
                    $this->legacySameDayTransition($schedule, $now, $updatedToActive, $updatedToCompleted);

                    continue;
                }

                [$startAt, $endAt] = $schedule->windowBounds();

                if ($schedule->status === 'scheduled' && $now->gte($startAt) && $now->lte($endAt)) {
                    $schedule->update(['status' => 'active', 'updated_at' => now()]);
                    $updatedToActive++;
                } elseif ($schedule->status === 'active' && $now->gt($endAt)) {
                    $schedule->update(['status' => 'completed', 'updated_at' => now()]);
                    $updatedToCompleted++;
                }
            }

            $this->info("Updated {$updatedToActive} schedules to active and {$updatedToCompleted} schedules to completed");

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Error updating schedule statuses: ' . $e->getMessage());
            Log::error('Schedule status update error: ' . $e->getMessage());

            return Command::FAILURE;
        }
    }

    private function legacySameDayTransition(Schedule $schedule, Carbon $now, int &$updatedToActive, int &$updatedToCompleted): void
    {
        $today = $now->format('Y-m-d');
        $currentTime = $now->format('H:i:s');

        $dateYmd = $schedule->date instanceof \Carbon\CarbonInterface
            ? $schedule->date->format('Y-m-d')
            : Carbon::parse((string) $schedule->date)->format('Y-m-d');

        $startStr = $schedule->start_time instanceof \Carbon\CarbonInterface
            ? $schedule->start_time->format('H:i:s')
            : Carbon::parse((string) $schedule->start_time)->format('H:i:s');
        $endStr = $schedule->end_time instanceof \Carbon\CarbonInterface
            ? $schedule->end_time->format('H:i:s')
            : Carbon::parse((string) $schedule->end_time)->format('H:i:s');

        if ($schedule->status === 'scheduled'
            && $dateYmd === $today
            && $startStr <= $currentTime
            && $endStr >= $currentTime) {
            $schedule->update(['status' => 'active', 'updated_at' => now()]);
            $updatedToActive++;
        } elseif ($schedule->status === 'active'
            && $dateYmd === $today
            && $endStr < $currentTime) {
            $schedule->update(['status' => 'completed', 'updated_at' => now()]);
            $updatedToCompleted++;
        }
    }
}
