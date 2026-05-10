<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->decimal('latitude', 10, 7)->nullable()->after('bus_id');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->string('location_label', 512)->nullable()->after('longitude');
            $table->string('incident_type', 64)->nullable()->after('location_label');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude', 'location_label', 'incident_type']);
        });
    }
};
