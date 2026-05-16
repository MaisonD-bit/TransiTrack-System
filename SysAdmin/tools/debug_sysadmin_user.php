<?php
// Local debug helper (do not deploy).

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$email = 'sysadmin@transitrack.local';

$row = DB::table('sysadmin_users')->where('email', $email)->first();
echo json_encode([
    'email' => $email,
    'exists' => (bool) $row,
    'id' => $row->id ?? null,
    'name' => $row->name ?? null,
    'created_at' => $row->created_at ?? null,
], JSON_PRETTY_PRINT) . PHP_EOL;

