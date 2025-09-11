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
            $table->string('name');
            $table->string('code')->unique();
            $table->string('start_location');
            $table->string('end_location');
            $table->decimal('regular_price', 8, 2)->default(0);
            $table->decimal('aircon_price', 8, 2)->nullable();
            $table->decimal('distance_km', 8, 2)->default(0);
            $table->integer('estimated_duration')->default(0);
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('route_stops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('route_id')->constrained()->onDelete('cascade');
            $table->foreignId('stop_id')->constrained()->onDelete('cascade');
            $table->integer('stop_order');
            $table->integer('estimated_minutes')->default(0);
            $table->timestamps();
            
            $table->unique(['route_id', 'stop_id', 'stop_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('route');
    }
};
