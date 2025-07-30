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
        Schema::create('buses', function (Blueprint $table) {
            $table->bigIncrements('bus_id');
            $table->string('plate_number');
            $table->string('company');
            $table->string('type');
            $table->enum('rental_status', ['active', 'inactive']);
            $table->integer('capacity');
            $table->enum('status', ['active', 'inactive', 'maintenance']);

            $table->unsignedBigInteger('space_id')->nullable();
            $table->foreign('space_id')->references('space_id')->on('spaces')->onDelete('set null');

            $table->unsignedBigInteger('route_id')->nullable();
            $table->foreign('route_id')->references('route_id')->on('routes')->onDelete('set null');

            $table->unsignedBigInteger('driver_id')->nullable();
            $table->foreign('driver_id')->references('driver_id')->on('drivers')->onDelete('set null');
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('buses');
    }
};
