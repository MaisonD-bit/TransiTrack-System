<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->unsignedBigInteger('return_trip_route_id')->nullable()->after('status');
            $table->foreign('return_trip_route_id')->references('id')->on('routes')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->dropForeign(['return_trip_route_id']);
            $table->dropColumn('return_trip_route_id');
        });
    }
};
