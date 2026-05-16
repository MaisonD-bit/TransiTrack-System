<?php
// Local debug helper (do not deploy).

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Driver;
use App\Models\DriverLocation;
use App\Models\User;

function out($label, $value): void {
    echo "== {$label} ==\n";
    echo json_encode($value, JSON_PRETTY_PRINT) . "\n\n";
}

$operator = User::query()
    ->where('company_name', 'like', '%Genevra%')
    ->orWhere('name', 'like', '%Genevra%')
    ->first();

$driver = Driver::query()
    ->where('name', 'like', '%Archard%')
    ->first();

out('operator', $operator ? ['id' => $operator->id, 'name' => $operator->name, 'company_name' => $operator->company_name, 'email' => $operator->email] : null);
out('driver', $driver ? ['id' => $driver->id, 'name' => $driver->name, 'user_id' => $driver->user_id, 'email' => $driver->email] : null);

$rows = DriverLocation::query()
    ->orderByDesc('recorded_at')
    ->limit(10)
    ->get()
    ->map(fn ($r) => [
        'id' => $r->id,
        'driver_id' => $r->driver_id,
        'schedule_id' => $r->schedule_id,
        'lat' => $r->latitude,
        'lng' => $r->longitude,
        'recorded_at' => optional($r->recorded_at)->toIso8601String(),
    ])
    ->all();

out('latest_driver_locations', $rows);

