<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->unsignedSmallInteger('trip_leg')->default(1)->after('return_trip_status');
            $table->enum('leg_status', ['pending', 'accepted', 'active', 'completed'])->default('pending')->after('trip_leg');
        });

        // Backfill existing rows based on current status / return_trip_status
        DB::statement("
            UPDATE schedules SET
                trip_leg = CASE
                    WHEN return_trip_status IN ('pending', 'accepted', 'active', 'completed') THEN 2
                    ELSE 1
                END,
                leg_status = CASE
                    WHEN return_trip_status = 'active'    THEN 'active'
                    WHEN return_trip_status = 'accepted'  THEN 'accepted'
                    WHEN return_trip_status = 'pending'   THEN 'pending'
                    WHEN return_trip_status = 'completed' THEN 'completed'
                    WHEN status = 'active'    THEN 'active'
                    WHEN status = 'accepted'  THEN 'accepted'
                    WHEN status IN ('completed', 'cancelled', 'declined') THEN 'completed'
                    ELSE 'pending'
                END
        ");
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn(['trip_leg', 'leg_status']);
        });
    }
};
