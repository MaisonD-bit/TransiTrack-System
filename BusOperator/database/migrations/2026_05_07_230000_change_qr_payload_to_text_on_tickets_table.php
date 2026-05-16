<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Use raw ALTER to avoid requiring doctrine/dbal for ->change().
        DB::statement("ALTER TABLE `tickets` MODIFY `qr_payload` TEXT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE `tickets` MODIFY `qr_payload` VARCHAR(255) NULL");
    }
};

