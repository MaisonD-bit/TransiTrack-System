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
        Schema::table('commuters', function (Blueprint $table) {
            $table->string('first_name')->after('name');
            $table->string('middle_name')->nullable()->after('first_name');
            $table->string('last_name')->after('middle_name');
            $table->string('address')->nullable()->after('last_name');
            $table->string('contact_number')->nullable()->after('address');
            $table->enum('gender', ['male', 'female', 'other'])->nullable()->after('contact_number');
            $table->string('photo_url')->nullable()->after('gender');
            $table->enum('passenger_type', ['Regular', 'Student', 'Senior', 'PWD'])->default('Regular')->after('photo_url');
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active')->after('passenger_type');
        });
    }

    public function down(): void
    {
        Schema::table('commuters', function (Blueprint $table) {
            $table->dropColumn(['first_name', 'middle_name', 'last_name', 'address', 'contact_number', 'gender', 'photo_url', 'passenger_type', 'status']);
        });
    }
};
