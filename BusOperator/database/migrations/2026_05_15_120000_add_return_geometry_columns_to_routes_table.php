<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Inline return-leg path (reversed outbound) — used by schedules / commuter API.
     * Safe if 2026_05_12_133420 already ran or partially failed.
     */
    public function up(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            if (! Schema::hasColumn('routes', 'return_geometry')) {
                $table->text('return_geometry')->nullable()->after('geometry');
            }
            if (! Schema::hasColumn('routes', 'return_stops_data')) {
                $table->json('return_stops_data')->nullable()->after('stops_data');
            }
        });
    }

    public function down(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $drops = array_values(array_filter([
                Schema::hasColumn('routes', 'return_geometry') ? 'return_geometry' : null,
                Schema::hasColumn('routes', 'return_stops_data') ? 'return_stops_data' : null,
            ]));
            if ($drops !== []) {
                $table->dropColumn($drops);
            }
        });
    }
};
