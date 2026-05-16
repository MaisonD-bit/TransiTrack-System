<?php

namespace App\Http\Controllers;

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
        return view('users.forgot-password');
    }

    public function sendForgot(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $email = strtolower(trim((string) $data['email']));
        $role = 'terminal_manager';

        // Do not leak whether email exists.
        $exists = User::query()
            ->where('role', 'terminalManager')
            ->whereRaw('LOWER(email)=?', [$email])
            ->exists();

        if ($exists) {
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
            $link = "{$appUrl}/reset-password?email=".urlencode($email)."&token={$token}";

            Mail::raw(
                "TransiTrack (Terminal Manager) password reset request\n\n".
                "Email: {$email}\n\n".
                "Reset link (expires in 30 minutes):\n{$link}\n\n".
                "If you did not request this, ignore this email.",
                function ($m) use ($email) {
                    $m->to($email)->subject('TransiTrack Terminal Manager Password Reset');
                }
            );
        }

        return redirect()->back()->with('success', 'If your email exists, a reset link was sent.');
    }

    public function showReset(Request $request)
    {
        $email = (string) $request->query('email', '');
        $token = (string) $request->query('token', '');
        return view('users.reset-password', compact('email', 'token'));
    }

    public function submitReset(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string', 'min:10'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $email = strtolower(trim((string) $data['email']));
        $tokenHash = hash('sha256', (string) $data['token']);

        $row = DB::table('password_reset_requests')
            ->where('role', 'terminal_manager')
            ->where('email', $email)
            ->where('token_hash', $tokenHash)
            ->first();

        if (! $row || now()->greaterThan($row->expires_at)) {
            return redirect()->back()->withErrors(['token' => 'Invalid or expired reset token.']);
        }

        $updated = (bool) User::query()
            ->where('role', 'terminalManager')
            ->whereRaw('LOWER(email)=?', [$email])
            ->update(['password' => Hash::make((string) $data['password'])]);

        if (! $updated) {
            return redirect()->back()->withErrors(['email' => 'Account not found.']);
        }

        DB::table('password_reset_requests')
            ->where('role', 'terminal_manager')
            ->where('email', $email)
            ->delete();

        return redirect()->route('login')->with('success', 'Password reset successfully. You can sign in now.');
    }
}

