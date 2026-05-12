<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Some databases were created without Laravel's timestamp columns; Eloquent then fails on save()
     * (e.g. driver position updates) with "Unknown column 'updated_at'".
     */
    public function up(): void
    {
        if (!Schema::hasTable('schedules')) {
            return;
        }

        if (!Schema::hasColumn('schedules', 'created_at')) {
            Schema::table('schedules', function (Blueprint $table) {
                $table->timestamp('created_at')->nullable();
            });
        }

        if (!Schema::hasColumn('schedules', 'updated_at')) {
            Schema::table('schedules', function (Blueprint $table) {
                $table->timestamp('updated_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        // Intentionally non-destructive: do not drop columns that may now hold data.
    }
};
