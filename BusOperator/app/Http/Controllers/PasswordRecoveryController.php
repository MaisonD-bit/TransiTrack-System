<?php

namespace App\Http\Controllers;

use App\Models\Commuter;
use App\Models\Driver;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class PasswordRecoveryController extends Controller
{
    public function showForgot()
    {
        return view('forgot-password');
    }

    public function submitForgotWeb(Request $request)
    {
        $email = strtolower(trim((string) $request->validate(['email' => ['required', 'email']])['email']));
        // Web BusOperator site: operator only
        $this->issueReset('operator', $email);
        return redirect()->back()->with('success', 'If your email exists, a reset link was sent.');
    }

    public function showReset(Request $request)
    {
        $role = (string) $request->query('role', 'operator');
        $email = (string) $request->query('email', '');
        $token = (string) $request->query('token', '');
        return view('reset-password', compact('role', 'email', 'token'));
    }

    public function submitResetWeb(Request $request)
    {
        $data = $request->validate([
            'role' => ['required', 'in:commuter,driver,operator'],
            'email' => ['required', 'email'],
            'token' => ['required', 'string', 'min:10'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $role = $data['role'];
        $email = strtolower(trim((string) $data['email']));
        $tokenHash = hash('sha256', (string) $data['token']);

        $row = DB::table('password_reset_requests')
            ->where('role', $role)
            ->where('email', $email)
            ->where('token_hash', $tokenHash)
            ->first();

        if (! $row || now()->greaterThan($row->expires_at)) {
            return redirect()->back()->withErrors(['token' => 'Invalid or expired reset token.']);
        }

        $updated = $this->updatePasswordForRole($role, $email, (string) $data['password']);
        if (! $updated) {
            return redirect()->back()->withErrors(['email' => 'Account not found.']);
        }

        DB::table('password_reset_requests')
            ->where('role', $role)
            ->where('email', $email)
            ->delete();

        return redirect()->route('login')->with('success', 'Password reset successfully. You can sign in now.');
    }

    public function forgot(Request $request)
    {
        $data = $request->validate([
            'role' => ['required', 'in:commuter,driver,operator'],
            'email' => ['required', 'email'],
        ]);

        $role = $data['role'];
        $email = strtolower(trim((string) $data['email']));

        $this->issueReset($role, $email);

        return response()->json(['success' => true]);
    }

    public function reset(Request $request)
    {
        $data = $request->validate([
            'role' => ['required', 'in:commuter,driver,operator'],
            'email' => ['required', 'email'],
            'token' => ['required', 'string', 'min:10'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $role = $data['role'];
        $email = strtolower(trim((string) $data['email']));
        $tokenHash = hash('sha256', (string) $data['token']);

        $row = DB::table('password_reset_requests')
            ->where('role', $role)
            ->where('email', $email)
            ->where('token_hash', $tokenHash)
            ->first();

        if (! $row || now()->greaterThan($row->expires_at)) {
            return response()->json(['success' => false, 'message' => 'Invalid or expired reset token.'], 422);
        }

        $updated = $this->updatePasswordForRole($role, $email, (string) $data['password']);
        if (! $updated) {
            return response()->json(['success' => false, 'message' => 'Account not found.'], 404);
        }

        DB::table('password_reset_requests')
            ->where('role', $role)
            ->where('email', $email)
            ->delete();

        return response()->json(['success' => true]);
    }

    private function userExistsForRole(string $role, string $email): bool
    {
        return match ($role) {
            'commuter' => Commuter::query()->whereRaw('LOWER(email)=?', [$email])->exists(),
            'driver' => Driver::query()->whereRaw('LOWER(email)=?', [$email])->exists(),
            'operator' => User::query()->where('role', 'bus_operator')->whereRaw('LOWER(email)=?', [$email])->exists(),
            default => false,
        };
    }

    private function issueReset(string $role, string $email): void
    {
        // Don’t leak whether email exists.
        if (! $this->userExistsForRole($role, $email)) {
            return;
        }

        $token = Str::random(64);
        $tokenHash = hash('sha256', $token);
        $expiresAt = now()->addMinutes(30);

        DB::table('password_reset_requests')
            ->where('role', $role)
            ->where('email', $email)
            ->delete();

        DB::table('password_reset_requests')->insert([
            'role' => $role,
            'email' => $email,
            'token_hash' => $tokenHash,
            'expires_at' => $expiresAt,
            'created_at' => now(),
        ]);

        $appUrl = rtrim((string) config('app.url'), '/');
        $link = "{$appUrl}/reset-password?role={$role}&email=".urlencode($email)."&token={$token}";

        Mail::raw(
            "TransiTrack password reset request\n\n".
            "Role: {$role}\n".
            "Email: {$email}\n\n".
            "Reset link (expires in 30 minutes):\n{$link}\n\n".
            "If you did not request this, ignore this email.",
            function ($m) use ($email) {
                $m->to($email)->subject('TransiTrack Password Reset');
            }
        );
    }

    private function updatePasswordForRole(string $role, string $email, string $newPassword): bool
    {
        return match ($role) {
            'commuter' => (bool) Commuter::query()->whereRaw('LOWER(email)=?', [$email])->update(['password' => Hash::make($newPassword)]),
            'driver' => (bool) Driver::query()->whereRaw('LOWER(email)=?', [$email])->update(['password' => Hash::make($newPassword)]),
            'operator' => (bool) User::query()
                ->where('role', 'bus_operator')
                ->whereRaw('LOWER(email)=?', [$email])
                ->update(['password' => Hash::make($newPassword)]),
            default => false,
        };
    }
}

