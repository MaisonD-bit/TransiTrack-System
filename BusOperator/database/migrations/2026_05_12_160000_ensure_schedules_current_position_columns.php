<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ensures schedules has live-position columns (some DBs skipped the original migration).
     */
    public function up(): void
    {
        if (! Schema::hasTable('schedules')) {
            return;
        }

        Schema::table('schedules', function (Blueprint $table) {
            if (! Schema::hasColumn('schedules', 'current_lat')) {
                $table->decimal('current_lat', 10, 7)->nullable();
            }
            if (! Schema::hasColumn('schedules', 'current_lng')) {
                $table->decimal('current_lng', 10, 7)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('schedules')) {
            return;
        }

        Schema::table('schedules', function (Blueprint $table) {
            if (Schema::hasColumn('schedules', 'current_lat')) {
                $table->dropColumn('current_lat');
            }
            if (Schema::hasColumn('schedules', 'current_lng')) {
                $table->dropColumn('current_lng');
            }
        });
    }
};
