<?php

namespace App\Support;

use App\Models\User as Manager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

trait ManagerUsersLink
{
    /**
     * Announcements/notifications FK `sender_id` references `users.id`.
     * Managers authenticate from `managers`; resolve or create the linked users row.
     */
    protected function resolveManagerUsersId(?Manager $manager = null): ?int
    {
        $manager ??= auth()->user();
        if (! $manager) {
            return null;
        }

        if (! empty($manager->user_id)) {
            return (int) $manager->user_id;
        }

        $existing = DB::table('users')->where('email', $manager->email)->first();
        if ($existing) {
            $this->persistManagerUserIdLink((int) $manager->id, (int) $existing->id);

            return (int) $existing->id;
        }

        $firstName = $manager->first_name ?: Str::before((string) $manager->name, ' ');
        $lastName = $manager->last_name ?: Str::after((string) $manager->name, ' ');
        if (trim($lastName) === '') {
            $lastName = $firstName;
        }

        $usersId = DB::table('users')->insertGetId([
            'name' => trim($firstName.' '.$lastName),
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $manager->email,
            'password' => bcrypt(Str::random(32)),
            'role' => 'terminalManager',
            'terminal' => $manager->terminal,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->persistManagerUserIdLink((int) $manager->id, $usersId);

        return $usersId;
    }

    private function persistManagerUserIdLink(int $managerId, int $usersId): void
    {
        if (! Schema::hasColumn('managers', 'user_id')) {
            return;
        }

        DB::table('managers')
            ->where('id', $managerId)
            ->where(function ($q) {
                $q->whereNull('user_id')->orWhere('user_id', 0);
            })
            ->update(['user_id' => $usersId, 'updated_at' => now()]);
    }
}
