<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Route;
use App\Services\RouteDistanceCalculator;

class CalculateRouteDistances extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'routes:calculate-distances';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Calculate and update distance_km for all routes with geometry data';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $this->info('Calculating distances for all routes...');

        $routes = Route::whereNotNull('geometry')->get();
        
        if ($routes->isEmpty()) {
            $this->warn('No routes with geometry data found.');
            return 0;
        }

        $updated = 0;
        $skipped = 0;

        foreach ($routes as $route) {
            try {
                $distance = RouteDistanceCalculator::calculateDistance($route->geometry);
                
                if ($distance > 0) {
                    $route->distance_km = $distance;
                    $route->save();
                    $this->info("✓ Route '{$route->name}' ({$route->code}): {$distance} km");
                    $updated++;
                } else {
                    $this->warn("✗ Route '{$route->name}' ({$route->code}): Unable to calculate distance");
                    $skipped++;
                }
            } catch (\Exception $e) {
                $this->error("✗ Route '{$route->name}' ({$route->code}): Error - " . $e->getMessage());
                $skipped++;
            }
        }

        $this->info("\n" . str_repeat('=', 50));
        $this->info("Summary:");
        $this->info("  Updated: {$updated} routes");
        $this->info("  Skipped: {$skipped} routes");
        $this->info(str_repeat('=', 50));

        return 0;
    }
}