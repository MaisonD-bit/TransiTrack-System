<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Models\User;
use App\Models\Commuter;

class AuthController extends Controller
{
    public function showLoginForm()
    {
        if (Auth::check()) {
            return redirect()->route('operator.panel');
        }
        return view('login');
    }

    public function showRegisterForm()
    {
        if (Auth::check()) {
            return redirect()->route('operator.panel');
        }
        return view('register');
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $credentials = $request->only('email', 'password');
        
        if (Auth::attempt($credentials, $request->filled('remember'))) {
            $request->session()->regenerate();
            
            $user = Auth::user();
            if ($user->role !== 'bus_operator') {
                Auth::logout();
                return back()->withErrors(['email' => 'Access denied. Bus operators only.'])->withInput();
            }
            
            return redirect()->intended(route('operator.panel'));
        }

        return back()->withErrors(['email' => 'Invalid credentials'])->withInput();
    }

    public function register(Request $request)
    {
        $request->validate([
            'first_name' => 'required|string|max:255', 
            'middle_initial' => 'nullable|string|max:1', 
            'last_name' => 'required|string|max:255', 
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|confirmed|min:8',
            'terminal' => 'required|in:north,south', 
            'company_name' => 'required|string|max:255',
            'company_address' => 'required|string|max:500',
            'company_contact' => 'required|string|max:20',
            'company_email' => 'required|email|max:255',
            'fleet_size' => 'required|integer|min:1',
            'photo' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        try {
            $photoPath = null;
            if ($request->hasFile('photo')) {
                $file = $request->file('photo');
                $filename = time() . '_' . $file->getClientOriginalName();
                $photoPath = $file->storeAs('operators', $filename, 'public');
            }

            $middle = $request->middle_initial ? ' ' . $request->middle_initial . '.' : '';
            $fullName = $request->first_name . $middle . ' ' . $request->last_name;

            $user = User::create([
                'name' => $fullName,
                'first_name' => $request->first_name, 
                'middle_initial' => $request->middle_initial, 
                'last_name' => $request->last_name, 
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => 'bus_operator', 
                'terminal' => $request->terminal, 
                'company_name' => $request->company_name,
                'company_address' => $request->company_address,
                'company_contact' => $request->company_contact,
                'company_email' => $request->company_email,
                'fleet_size' => $request->fleet_size,
                'photo_url' => $photoPath,
                'status' => 'active',
            ]);

            return redirect()->route('login')->with('success', 'Registration successful! Please login with your credentials.');

        } catch (\Exception $e) {
            return back()->withErrors(['email' => 'Registration failed. Please try again.'])->withInput();
        }
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('login')->with('success', 'Logged out successfully');
    }

    /**
     * API Login - Authenticate commuter and return token
     */
    public function apiLogin(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        // Normalize input and authenticate only against commuters table
        $email = strtolower(trim((string) $request->email));
        $password = (string) $request->password;

        $commuter = Commuter::whereRaw('LOWER(email) = ?', [$email])->first();

        if (!$commuter) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials',
            ], 401);
        }

        $passwordMatches = Hash::check($password, (string) $commuter->password);

        // Backward compatibility: if legacy plain password exists, accept once and re-hash it.
        if (!$passwordMatches && hash_equals((string) $commuter->password, $password)) {
            $commuter->password = Hash::make($password);
            $commuter->save();
            $passwordMatches = true;
        }

        if (!$passwordMatches) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials',
            ], 401);
        }

        // Generate app token (non-Sanctum)
        $token = Str::random(80);

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'token' => $token,
            'user' => [
                'id' => $commuter->id,
                'name' => $commuter->name,
                'email' => $commuter->email,
                'created_at' => $commuter->created_at,
            ],
        ], 200);
    }

    /**
     * API Register - Create new commuter account
     */
    public function apiRegister(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:commuters,email',
            'password' => 'required|string|min:6|confirmed',
        ]);

        try {
            $name = trim((string) $request->name);
            $email = strtolower(trim((string) $request->email));

            $commuter = Commuter::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($request->password),
            ]);

            // Generate app token (non-Sanctum)
            $token = Str::random(80);

            return response()->json([
                'success' => true,
                'message' => 'Registration successful',
                'token' => $token,
                'user' => [
                    'id' => $commuter->id,
                    'name' => $commuter->name,
                    'email' => $commuter->email,
                    'created_at' => $commuter->created_at,
                ],
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Registration failed: ' . $e->getMessage(),
            ], 400);
        }
    }

    /**
     * API Logout - Revoke user's tokens
     */
    public function apiLogout(Request $request)
    {
        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully',
        ], 200);
    }

    /**
     * Get Authenticated User - Return current authenticated commuter
     */
    public function getAuthenticatedUser(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Not authenticated',
            ], 401);
        }

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'created_at' => $user->created_at,
            ],
        ], 200);
    }
}