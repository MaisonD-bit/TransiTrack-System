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
        Schema::create('schedules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('route_id')->constrained();
                $table->foreignId('bus_id')->constrained();
                $table->foreignId('driver_id')->constrained('users');
                $table->date('date');
                $table->time('start_time');
                $table->time('end_time');
                $table->string('status');
                $table->json('days')->nullable();
                $table->text('notes')->nullable();
                $table->json('actual_stops')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('schedule');
    }
};
