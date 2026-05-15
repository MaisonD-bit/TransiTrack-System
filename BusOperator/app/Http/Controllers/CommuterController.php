<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Commuter;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CommuterController extends Controller
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'first_name'    => 'required|string|max:255',
            'last_name'     => 'required|string|max:255',
            'middle_name'   => 'nullable|string|max:255',
            'email'         => 'required|email|unique:commuters,email',
            'address'       => 'nullable|string|max:500',
            'contact_number'=> 'nullable|string|max:20',
            'gender'        => 'nullable|in:male,female,other',
            'password'      => 'required|string|min:6',
            'password_confirmation' => 'nullable|string|same:password',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $commuter = Commuter::create([
            'name'           => trim($request->first_name . ' ' . $request->last_name),
            'first_name'     => $request->first_name,
            'middle_name'    => $request->middle_name,
            'last_name'      => $request->last_name,
            'email'          => $request->email,
            'address'        => $request->address,
            'contact_number' => $request->contact_number,
            'gender'         => $request->gender,
            'password'       => Hash::make($request->password),
        ]);

        return response()->json([
            'success' => true,
            'commuter' => $commuter
        ]);
    }

    public function updateProfile(Request $request, $id)
    {
        $commuter = Commuter::findOrFail($id);

        $update = [];

        $passengerType = $request->input('passengerType') ?? $request->input('passenger_type');
        if ($passengerType) {
            $type = ucfirst(strtolower(trim($passengerType)));
            if ($type === 'Pwd') $type = 'PWD';
            if (in_array($type, ['Regular', 'Student', 'Senior', 'PWD'], true)) {
                $update['passenger_type'] = $type;
            }
        }

        if ($request->has('name'))   $update['name']           = $request->input('name');
        if ($request->has('phone'))  $update['contact_number'] = $request->input('phone');

        if (!empty($update)) {
            $commuter->update($update);
        }

        return response()->json([
            'success'  => true,
            'commuter' => $commuter->fresh(),
        ]);
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $commuter = Commuter::where('email', $request->email)->first();

        if (!$commuter || !Hash::check($request->password, $commuter->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid email or password'
            ], 401);
        }

        return response()->json([
            'success' => true,
            'commuter' => $commuter
        ]);
    }
}