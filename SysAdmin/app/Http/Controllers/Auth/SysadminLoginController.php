<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SysadminLoginController extends Controller
{
    public function create()
    {
        if (Auth::guard('sysadmin')->check()) {
            return redirect()->route('sysadmin.dashboard');
        }

        return view('auth.login');
    }

    public function store(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (! Auth::guard('sysadmin')->attempt($credentials, $request->boolean('remember'))) {
            return back()->withErrors(['email' => 'These credentials do not match our records.'])->onlyInput('email');
        }

        $request->session()->regenerate();

        return redirect()->intended(route('sysadmin.dashboard'));
    }

    public function destroy(Request $request)
    {
        Auth::guard('sysadmin')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('sysadmin.login');
    }
}
