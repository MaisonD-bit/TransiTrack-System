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
            if (! Schema::hasColumn('commuters', 'first_name')) {
                $table->string('first_name')->after('name');
            }
            if (! Schema::hasColumn('commuters', 'middle_name')) {
                $table->string('middle_name')->nullable()->after('first_name');
            }
            if (! Schema::hasColumn('commuters', 'last_name')) {
                $table->string('last_name')->after('middle_name');
            }
            if (! Schema::hasColumn('commuters', 'address')) {
                $table->string('address')->nullable()->after('last_name');
            }
            if (! Schema::hasColumn('commuters', 'contact_number')) {
                $table->string('contact_number')->nullable()->after('address');
            }
            if (! Schema::hasColumn('commuters', 'gender')) {
                $table->enum('gender', ['male', 'female', 'other'])->nullable()->after('contact_number');
            }
            if (! Schema::hasColumn('commuters', 'photo_url')) {
                $table->string('photo_url')->nullable()->after('gender');
            }
            if (! Schema::hasColumn('commuters', 'passenger_type')) {
                $table->enum('passenger_type', ['Regular', 'Student', 'Senior', 'PWD'])->default('Regular')->after('photo_url');
            }
            if (! Schema::hasColumn('commuters', 'status')) {
                $table->enum('status', ['active', 'inactive', 'suspended'])->default('active')->after('passenger_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('commuters', function (Blueprint $table) {
            $drops = array_values(array_filter([
                Schema::hasColumn('commuters', 'first_name') ? 'first_name' : null,
                Schema::hasColumn('commuters', 'middle_name') ? 'middle_name' : null,
                Schema::hasColumn('commuters', 'last_name') ? 'last_name' : null,
                Schema::hasColumn('commuters', 'address') ? 'address' : null,
                Schema::hasColumn('commuters', 'contact_number') ? 'contact_number' : null,
                Schema::hasColumn('commuters', 'gender') ? 'gender' : null,
                Schema::hasColumn('commuters', 'photo_url') ? 'photo_url' : null,
                Schema::hasColumn('commuters', 'passenger_type') ? 'passenger_type' : null,
                Schema::hasColumn('commuters', 'status') ? 'status' : null,
            ]));
            if ($drops !== []) {
                $table->dropColumn($drops);
            }
        });
    }
};
