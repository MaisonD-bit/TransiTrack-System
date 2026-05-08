<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
    public function login()
    {
        if (Auth::check()) {
            return redirect()->route('dashboard')->with('success', 'Logged In!');
        }

        return view('users.login');
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('login')->with('success', 'Logged out!');
    }

    public function authenticate(Request $request)
    {
        $valid = $request->validate([
            'email' => 'required|email|max:255',
            'password' => 'required|string|min:8',
        ]);

        if (Auth::attempt(['email' => $request->email, 'password' => $request->password])) {
            $user = Auth::user();

            if ($user->role === 'terminalManager') {
                $request->session()->regenerate();
                return redirect()->intended(route('dashboard'));
            }

            Auth::logout();
            return redirect()->back()->withErrors(['email' => 'Only terminal managers are authorized to access.']);
        }

        return redirect()->back()->withErrors(['email' => 'Invalid email or password.']);
    }

    public function store(Request $request)
    {
        $valid = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email|unique:managers,email|max:255',
            'password' => 'required|string|min:8|confirmed',
            'contact_number' => 'required|string|max:50',
            'gender' => 'required|in:male,female',
            'terminal' => 'required|in:north,south',
            'photo' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
        ]);

        $name = $request->first_name . ' ' . $request->last_name;

        $photoPath = null;
        if ($request->hasFile('photo')) {
            $photoPath = $request->file('photo')->store('managers', 'public');
        }

        DB::transaction(function () use ($request, $name, $photoPath) {
            $hashedPassword = bcrypt($request->password);

            $userId = DB::table('users')->insertGetId([
                'name' => $name,
                'first_name' => $request->first_name,
                'last_name' => $request->last_name,
                'email' => $request->email,
                'password' => $hashedPassword,
                'contact_number' => $request->contact_number,
                'gender' => $request->gender,
                'role' => 'terminalManager',
                'terminal' => $request->terminal,
                'photo_url' => $photoPath,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            User::create([
                'user_id' => $userId,
                'name' => $name,
                'first_name' => $request->first_name,
                'last_name' => $request->last_name,
                'email' => $request->email,
                'password' => $hashedPassword,
                'contact_number' => $request->contact_number,
                'gender' => $request->gender,
                'role' => 'terminalManager',
                'terminal' => $request->terminal,
                'photo_url' => $photoPath,
            ]);
        });

        return redirect()->route('login')->withSuccess('User has been added successfully!');
    }

    public function register()
    {
        return view('users.register');
    }
}
