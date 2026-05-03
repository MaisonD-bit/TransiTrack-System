<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->enum('terminal', ['north', 'south'])->nullable()->after('user_id');
        });
    }

    public function down()
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->dropColumn('terminal');
        });
    }
};