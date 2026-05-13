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
            $table->string('return_trip_status')->nullable()->after('status');
        });

        // Remove old auto-created separate return-trip rows from previous approach
        DB::table('schedules')->where('is_return_trip', true)->delete();

        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn('is_return_trip');
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn('return_trip_status');
            $table->boolean('is_return_trip')->default(false)->after('status');
        });
    }
};
