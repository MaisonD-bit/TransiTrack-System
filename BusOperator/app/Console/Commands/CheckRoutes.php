<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Models\Route;

class CheckRoutes extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:check-routes';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check route geometry data';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $routes = Route::all();

        foreach ($routes as $route) {
            $this->info("Route ID: {$route->id}");
            $this->info("Name: {$route->name}");

            // Check raw database value
            $rawGeometry = DB::table('routes')->where('id', $route->id)->value('geometry');
            $this->info("Raw DB geometry: " . substr($rawGeometry, 0, 100) . "...");

            $this->info("Casted geometry type: " . gettype($route->geometry));
            $this->info("Casted geometry: " . json_encode($route->geometry));

            if (is_array($route->geometry) && isset($route->geometry['coordinates'])) {
                $this->info("  Coordinates count: " . count($route->geometry['coordinates']));
            } else {
                $this->info("❌ Coordinates count: 0 (casting failed)");
            }

            $this->info("---");
        }
    }
}