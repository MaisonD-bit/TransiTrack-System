<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
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
            // First check if date column exists
            if (!Schema::hasColumn('schedules', 'date')) {
                $this->error('The date column is missing from the schedules table.');
                $this->info('Run: php artisan migrate to add the missing column.');
                return Command::FAILURE;
            }
            
            $now = Carbon::now();
            $today = $now->format('Y-m-d');
            $currentTime = $now->format('H:i:s');
            
            $this->info("Current time: $currentTime on $today");
            
            // Update scheduled to active
            $updated1 = DB::table('schedules')
                ->where('status', 'scheduled')
                ->where('date', $today)  // Use simple equality comparison
                ->where('start_time', '<=', $currentTime)
                ->where('end_time', '>=', $currentTime)
                ->whereNull('deleted_at')
                ->update([
                    'status' => 'active',
                    'updated_at' => now()
                ]);
            
            // Update active to completed
            $updated2 = DB::table('schedules')
                ->where('status', 'active')
                ->where('date', $today)  // Use simple equality comparison
                ->where('end_time', '<', $currentTime)
                ->whereNull('deleted_at')
                ->update([
                    'status' => 'completed',
                    'updated_at' => now()
                ]);
            
            $this->info("Updated $updated1 schedules to active and $updated2 schedules to completed");
            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Error updating schedule statuses: ' . $e->getMessage());
            Log::error('Schedule status update error: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }
}