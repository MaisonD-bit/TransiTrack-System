<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drivers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade'); // 🔗 Bus operator ID

            // Auth & Profile
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('contact_number');
            $table->text('address');
            $table->date('date_of_birth');
            $table->enum('gender', ['male', 'female', 'other']);

            // License
            $table->string('license_number')->unique();
            $table->date('license_expiry');

            // Emergency Contact
            $table->string('emergency_name');
            $table->string('emergency_relation');
            $table->string('emergency_contact');

            // Status & Metadata
            $table->enum('status', ['active', 'inactive', 'pending', 'suspended', 'on_leave'])->default('pending');
            $table->text('notes')->nullable();
            $table->string('photo_url')->nullable();

            // App Registration
            $table->boolean('app_registered')->default(true);
            $table->string('registration_source')->default('mobile_app');
            $table->timestamp('last_app_login')->nullable();
            $table->string('device_token')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drivers');
    }
};