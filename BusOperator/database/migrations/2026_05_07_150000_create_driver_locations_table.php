<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained('drivers')->cascadeOnDelete();
            $table->foreignId('schedule_id')->nullable()->constrained('schedules')->nullOnDelete();

            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('accuracy_m', 10, 2)->nullable();
            $table->decimal('speed_mps', 10, 3)->nullable();
            $table->decimal('heading_deg', 10, 3)->nullable();

            $table->timestamp('recorded_at')->useCurrent();
            $table->timestamps();

            $table->index(['driver_id', 'recorded_at']);
            $table->index(['schedule_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_locations');
    }
};

