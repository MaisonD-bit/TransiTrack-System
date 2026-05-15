<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('schedules', 'trip_leg')) {
            return;
        }

        $afterColumn = Schema::hasColumn('schedules', 'return_trip_status')
            ? 'return_trip_status'
            : 'status';

        Schema::table('schedules', function (Blueprint $table) use ($afterColumn) {
            $table->unsignedSmallInteger('trip_leg')->default(1)->after($afterColumn);
            $table->enum('leg_status', ['pending', 'accepted', 'active', 'completed'])->default('pending')->after('trip_leg');
        });

        // Backfill existing rows based on current status / return_trip_status
        if (! Schema::hasColumn('schedules', 'return_trip_status')) {
            DB::statement("
            UPDATE schedules SET
                trip_leg = 1,
                leg_status = CASE
                    WHEN status = 'active'    THEN 'active'
                    WHEN status = 'accepted'  THEN 'accepted'
                    WHEN status IN ('completed', 'cancelled', 'declined') THEN 'completed'
                    ELSE 'pending'
                END
        ");

            return;
        }

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
        $drops = array_values(array_filter([
            Schema::hasColumn('schedules', 'trip_leg') ? 'trip_leg' : null,
            Schema::hasColumn('schedules', 'leg_status') ? 'leg_status' : null,
        ]));
        if ($drops === []) {
            return;
        }
        Schema::table('schedules', function (Blueprint $table) use ($drops) {
            $table->dropColumn($drops);
        });
    }
};
