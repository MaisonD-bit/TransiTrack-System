<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Models\SysadminUser;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('sysadmin:create {email} {name?} {--password=}', function () {
    /** @var string $email */
    $email = trim((string) $this->argument('email'));
    $name = trim((string) ($this->argument('name') ?: 'Sysadmin'));
    $password = (string) ($this->option('password') ?: '');

    if ($email === '' || ! str_contains($email, '@')) {
        $this->error('Provide a valid email.');
        return 1;
    }

    if (SysadminUser::query()->where('email', $email)->exists()) {
        $this->error("A sysadmin user with email {$email} already exists.");
        return 1;
    }

    if ($password === '') {
        $password = (string) $this->secret('Password');
    }
    if (strlen($password) < 8) {
        $this->error('Password must be at least 8 characters.');
        return 1;
    }

    $u = SysadminUser::query()->create([
        'name' => $name,
        'email' => $email,
        // Model casts password to "hashed"
        'password' => $password,
    ]);

    $this->info("Created sysadmin user #{$u->id} ({$u->email}).");
    return 0;
})->purpose('Create a SysAdmin account (sysadmin_users)');

Artisan::command('sysadmin:reset-password {email} {--password=}', function () {
    /** @var string $email */
    $email = trim((string) $this->argument('email'));
    $password = (string) ($this->option('password') ?: '');

    $u = SysadminUser::query()->where('email', $email)->first();
    if (! $u) {
        $this->error("No sysadmin user found for {$email}.");
        return 1;
    }

    if ($password === '') {
        $password = (string) $this->secret('New password');
    }
    if (strlen($password) < 8) {
        $this->error('Password must be at least 8 characters.');
        return 1;
    }

    $u->password = $password;
    $u->save();

    $this->info("Password reset for {$email}.");
    return 0;
})->purpose('Reset password for a SysAdmin account');
