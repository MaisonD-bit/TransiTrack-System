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
        Schema::create('routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade'); //   Critical
            $table->string('name');
            $table->string('code')->unique();
            $table->string('start_location');
            $table->string('end_location');
            $table->string('start_coordinates')->nullable();
            $table->string('end_coordinates')->nullable();
            $table->text('stops_data')->nullable();
            $table->text('description')->nullable();
            $table->decimal('regular_price', 8, 2)->nullable();
            $table->decimal('aircon_price', 8, 2)->nullable();
            $table->decimal('route_fare', 8, 2)->nullable();
            $table->decimal('distance_km', 8, 2)->nullable();
            $table->integer('estimated_duration')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->enum('bus_type', ['regular', 'aircon'])->default('regular');
            $table->text('geometry')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('routes');
    }
};
