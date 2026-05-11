<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE schedules MODIFY COLUMN status ENUM('scheduled','accepted','active','completed','declined','cancelled','pending_decline') NOT NULL DEFAULT 'scheduled'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE schedules MODIFY COLUMN status ENUM('scheduled','accepted','active','completed','declined','cancelled') NOT NULL DEFAULT 'scheduled'");
    }
};
