<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add return-trip columns to routes
        Schema::table('routes', function (Blueprint $table) {
            $table->text('return_geometry')->nullable()->after('geometry');
            $table->json('return_stops_data')->nullable()->after('stops_data');
        });

        // 2. Migrate: copy return-route geometry/stops into the parent route row
        $returnRoutes = DB::table('routes')->where('is_return_trip', true)->get();
        foreach ($returnRoutes as $ret) {
            if ($ret->return_trip_route_id) {
                DB::table('routes')
                    ->where('id', $ret->return_trip_route_id)
                    ->update([
                        'return_geometry'   => $ret->geometry,
                        'return_stops_data' => $ret->stops_data,
                    ]);
            }
        }

        // 3. Delete hidden return-route rows
        DB::table('routes')->where('is_return_trip', true)->delete();

        // 4. Drop old return-trip columns from routes
        Schema::table('routes', function (Blueprint $table) {
            $table->dropForeign(['return_trip_route_id']);
            $table->dropColumn(['return_trip_route_id', 'is_return_trip']);
        });

        // 5. Add is_return_trip flag to schedules
        Schema::table('schedules', function (Blueprint $table) {
            $table->boolean('is_return_trip')->default(false)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn('is_return_trip');
        });

        Schema::table('routes', function (Blueprint $table) {
            $table->dropColumn(['return_geometry', 'return_stops_data']);
        });
    }
};
