<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boarding_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('schedule_id');
            $table->unsignedBigInteger('route_id')->nullable();
            $table->unsignedSmallInteger('from_stop_index')->default(0);
            $table->decimal('boarding_lng', 10, 7)->nullable();
            $table->decimal('boarding_lat', 10, 7)->nullable();
            $table->string('boarding_stop_name')->nullable();
            $table->unsignedBigInteger('commuter_id')->nullable();
            $table->string('commuter_name')->nullable();
            $table->string('commuter_email')->nullable();
            $table->enum('status', ['waiting', 'boarded', 'cancelled'])->default('waiting');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boarding_requests');
    }
};
