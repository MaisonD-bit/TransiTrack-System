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
        Schema::create('bus_schedules', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->time('departure_time');
            $table->time('arrival_time');
            $table->enum('status', ['scheduled', 'in_progress', 'completed', 'cancelled'])->default('scheduled');

            $table->unsignedBigInteger('bus_id')->nullable();
            $table->foreign('bus_id')->references('bus_id')->on('buses')->onDelete('set null');

            $table->unsignedBigInteger('route_id')->nullable();
            $table->foreign('route_id')->references('route_id')->on('routes')->onDelete('set null');

            $table->unsignedBigInteger('driver_id')->nullable();
            $table->foreign('driver_id')->references('driver_id')->on('drivers')->onDelete('set null');

            $table->unsignedBigInteger('space_id')->nullable();
            $table->foreign('space_id')->references('space_id')->on('spaces')->onDelete('set null');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bus_schedule');
    }
};
