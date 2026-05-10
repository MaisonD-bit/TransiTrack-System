<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade'); //   Critical
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->foreignId('route_id')->constrained()->onDelete('cascade');
            $table->foreignId('driver_id')->constrained('drivers')->onDelete('cascade');
            $table->foreignId('bus_id')->constrained()->onDelete('cascade');
            $table->enum('status', ['scheduled','accepted','active','completed','declined','cancelled'])->default('scheduled');
            $table->decimal('fare_regular', 8, 2)->nullable();
            $table->decimal('fare_aircon', 8, 2)->nullable();
            $table->integer('time_limit')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('declined_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('schedules');
    }
};
