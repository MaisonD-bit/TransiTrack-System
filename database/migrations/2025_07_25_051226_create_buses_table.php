<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('buses', function (Blueprint $table) {
            $table->id();
            $table->string('plate_number')->unique();
            $table->string('bus_number')->unique();
            $table->string('model');
            $table->integer('capacity');
            $table->string('bus_company')->nullable();
            $table->enum('accommodation_type', ['regular', 'air-conditioned'])
                  ->default('regular')
                  ->comment('Type of accommodation/comfort level');
            $table->enum('status', ['available', 'in_service', 'maintenance', 'out_of_service'])->default('available');
            $table->enum('terminal', ['north', 'south'])->nullable(); 
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('buses');
    }
};