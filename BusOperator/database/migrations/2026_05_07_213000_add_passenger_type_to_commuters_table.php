<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commuters', function (Blueprint $table) {
            if (! Schema::hasColumn('commuters', 'passenger_type')) {
                $table->string('passenger_type', 16)->default('Regular')->after('password');
            }
        });
    }

    public function down(): void
    {
        Schema::table('commuters', function (Blueprint $table) {
            if (Schema::hasColumn('commuters', 'passenger_type')) {
                $table->dropColumn('passenger_type');
            }
        });
    }
};

