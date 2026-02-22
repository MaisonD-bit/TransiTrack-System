<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
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

    public function down()
    {
        Schema::dropIfExists('route_stops');
    }
};
