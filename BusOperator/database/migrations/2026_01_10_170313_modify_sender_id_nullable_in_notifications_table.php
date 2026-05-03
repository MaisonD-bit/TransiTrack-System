<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->unsignedBigInteger('sender_id')->nullable()->change(); // Make sender_id nullable
        });
    }

    public function down()
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->unsignedBigInteger('sender_id')->nullable(false)->change(); // Revert to not nullable
        });
    }
};