<?php

namespace App\Support;

class PublicMediaUrl
{
    public static function resolve(?string $path, ?string $baseUrl = null): ?string
    {
        if ($path === null || trim($path) === '') {
            return null;
        }

        $path = trim($path);

        if (preg_match('/^https?:\/\//i', $path)) {
            return $path;
        }

        $base = rtrim($baseUrl ?? (string) config('app.url'), '/');

        if (str_starts_with($path, '/storage/')) {
            return $base.$path;
        }

        if (str_starts_with($path, 'storage/')) {
            return $base.'/'.$path;
        }

        return $base.'/storage/'.ltrim($path, '/');
    }

    /**
     * Resolve profile photos that may live on BusOperator or TerminalManager storage.
     */
    public static function forProfilePhoto(?string $photoUrl): ?string
    {
        if ($photoUrl === null || trim($photoUrl) === '') {
            return null;
        }

        $path = trim($photoUrl);

        if (preg_match('/^https?:\/\//i', $path)) {
            return $path;
        }

        if (str_starts_with($path, 'operators/') || str_starts_with($path, 'drivers/')) {
            return self::resolve($path, config('services.bus_operator.url'));
        }

        if (str_starts_with($path, 'managers/')) {
            return self::resolve($path, config('services.terminal_manager.url'));
        }

        return self::resolve($path);
    }
}
