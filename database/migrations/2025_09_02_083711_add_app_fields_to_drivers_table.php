<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('drivers', function (Blueprint $table) {
            // Check if columns exist before adding
            if (!Schema::hasColumn('drivers', 'registration_source')) {
                $table->string('registration_source')->default('web')->after('status');
            }
            if (!Schema::hasColumn('drivers', 'last_app_login')) {
                $table->timestamp('last_app_login')->nullable()->after('registration_source');
            }
            if (!Schema::hasColumn('drivers', 'device_token')) {
                $table->string('device_token')->nullable()->after('last_app_login');
            }
        });
    }

    public function down()
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->dropColumn(['registration_source', 'last_app_login', 'device_token']);
        });
    }
};