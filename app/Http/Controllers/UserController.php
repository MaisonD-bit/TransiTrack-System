<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserController extends Controller
{
    public function login()
    {
        if (Auth::check()) {
            return redirect()->route('adashboard')->with('success', 'Logged In!');
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
            'password' => 'required|string|min:6',
        ]);

        if (Auth::attempt(['email' => $request->email, 'password' => $request->password])) {
            $request->session()->regenerate();

            return redirect()->intended(route('dashboard'));
        }

        return redirect()->back()->withErrors(['name' => 'User does not exist in the system!',]);
    }

    public function store(Request $request)
    {
        $valid = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users|max:255',
            'password' => 'required|string|min:6|confirmed',
            'contact_number' => 'required|string|max:50',
            'gender' => 'required|in:male,female',
            'role' => 'required|in:manager',
            'photo' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
        ]);


        $photoPath = null;
        if ($request->hasFile('photo')) {
            $photoPath = $request->file('photo')->store('operators', 'public');
        }

        User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => bcrypt($request->password),
            'contact_number' => $request->contact_number,
            'gender' => $request->gender,
            'role' => 'manager',
            'photo_url' => $photoPath,
        ]);

        return redirect()->route('login')->withSuccess('User has been added successfully!');
    }

    public function register()
    {
        return view('users.register');
    }
}
