<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('schedules', 'return_trip_status')) {
            Schema::table('schedules', function (Blueprint $table) {
                $table->string('return_trip_status')->nullable()->after('status');
            });
        }

        // Remove old auto-created separate return-trip rows from previous approach
        if (Schema::hasColumn('schedules', 'is_return_trip')) {
            DB::table('schedules')->where('is_return_trip', true)->delete();

            Schema::table('schedules', function (Blueprint $table) {
                $table->dropColumn('is_return_trip');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('schedules', 'return_trip_status')) {
            Schema::table('schedules', function (Blueprint $table) {
                $table->dropColumn('return_trip_status');
            });
        }

        if (! Schema::hasColumn('schedules', 'is_return_trip')) {
            Schema::table('schedules', function (Blueprint $table) {
                $table->boolean('is_return_trip')->default(false)->after('status');
            });
        }
    }
};
