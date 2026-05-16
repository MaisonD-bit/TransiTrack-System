<?php

namespace App\Http\Controllers;

use App\Models\Driver;
use App\Models\Schedule;
use App\Models\Route as BusRoute;
use App\Models\Bus;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DriverController extends Controller
{
    /**
     * Display driver panel
     */
    public function index()
    {
        $userId = auth()->id(); 

        $drivers = Driver::with(['schedules' => function($query) {
            $query->where('date', '>=', now()->toDateString())
                ->orderBy('date')
                ->orderBy('start_time');
        }])
        ->where('user_id', $userId)
        ->orderBy('created_at', 'desc')
        ->paginate(15);

        // Add performance metrics to each driver
        $drivers->getCollection()->transform(function($driver) {
            $totalSchedules = $driver->schedules()->count();
            $completedSchedules = $driver->schedules()->where('status', 'completed')->count();
            $acceptedSchedules = $driver->schedules()->whereIn('status', ['completed', 'active', 'started'])->count();
            
            $driver->performance = [
                'total_schedules' => $totalSchedules,
                'completed_schedules' => $completedSchedules,
                'accepted_schedules' => $acceptedSchedules,
                'completion_rate' => $totalSchedules > 0 ? round(($completedSchedules / $totalSchedules) * 100, 1) : 0,
                'acceptance_rate' => $totalSchedules > 0 ? round(($acceptedSchedules / $totalSchedules) * 100, 1) : 0,
                'active_schedules' => $driver->schedules()->where('status', 'active')->count(),
                'pending_schedules' => $driver->schedules()->where('status', 'scheduled')->count(),
            ];
            
            return $driver;
        });

        $stats = [
            'total' => Driver::where('user_id', $userId)->count(),
            'active' => Driver::where('user_id', $userId)->where('status', 'active')->count(),
            'inactive' => Driver::where('user_id', $userId)->where('status', 'inactive')->count(),
            'pending' => Driver::where('user_id', $userId)->where('status', 'pending')->count(),
            'onLeave' => Driver::where('user_id', $userId)->where('status', 'on_leave')->count(),
        ];

        $routes = BusRoute::all();

        return view('panels.drivers', compact('drivers', 'stats', 'routes'));
    }

    /**
     * Store a new driver (web form)
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:drivers',
            'contact_number' => 'required|string|max:20',
            'date_of_birth' => 'required|date',
            'gender' => 'required|string|in:male,female,other',
            'address' => 'required|string',
            'license_number' => 'required|string|unique:drivers',
            'license_expiry' => 'required|date|after:today',
            'emergency_name' => 'string|max:255|nullable',
            'emergency_relation' => 'string|max:100|nullable',
            'emergency_contact' => 'string|max:20|nullable',
            'status' => 'required|string|in:active,inactive,pending',
            'photo' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $photoUrl = null;

            // Handle photo upload
            if ($request->hasFile('photo')) {
                $photo = $request->file('photo');
                $fileName = time() . '_' . uniqid() . '.' . $photo->getClientOriginalExtension();
                $photo->move(public_path('storage/drivers'), $fileName);
                $photoUrl = 'drivers/' . $fileName;
            }

            //   FIX: Automatically set user_id to logged-in user
            $driver = Driver::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make('driver123'), // Default password
                'contact_number' => $request->contact_number,
                'date_of_birth' => $request->date_of_birth,
                'gender' => $request->gender,
                'address' => $request->address,
                'license_number' => $request->license_number,
                'license_expiry' => $request->license_expiry,
                'emergency_name' => $request->emergency_name,
                'emergency_relation' => $request->emergency_relation,
                'emergency_contact' => $request->emergency_contact,
                'status' => $request->status,
                'photo_url' => $photoUrl,
                'app_registered' => false,
                'registration_source' => 'web_admin',
                'notes' => $request->notes,
                'user_id' => auth()->id(), //   Automatically set to logged-in user
            ]);

            Log::info('Driver created successfully from web', [
                'driver_id' => $driver->id,
                'driver_name' => $driver->name,
                'user_id' => auth()->id()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Driver created successfully!',
                'driver' => $driver
            ]);

        } catch (\Exception $e) {
            Log::error('Driver creation error: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create driver. Please try again.'
            ], 500);
        }
    }

    /**
     * Show driver details
     */
    public function show($id)
    {
        $driver = Driver::with(['schedules' => function($query) {
            $query->with(['route', 'bus'])
                ->orderBy('date', 'desc')
                ->orderBy('start_time', 'desc');
        }])->findOrFail($id);

        $upcomingSchedules = $driver->schedules()
            ->with(['route', 'bus'])
            ->where('date', '>=', now()->toDateString())
            ->orderBy('date')
            ->orderBy('start_time')
            ->get();

        $completedSchedules = $driver->schedules()
            ->with(['route', 'bus'])
            ->where('date', '<', now()->toDateString())
            ->orderBy('date', 'desc')
            ->orderBy('start_time', 'desc')
            ->limit(10)
            ->get();

        return response()->json([
            'id' => $driver->id,
            'name' => $driver->name,
            'email' => $driver->email,
            'contact_number' => $driver->contact_number,
            'date_of_birth' => $driver->date_of_birth ? $driver->date_of_birth->format('Y-m-d') : null,
            'gender' => $driver->gender,
            'address' => $driver->address,
            'license_number' => $driver->license_number,
            'license_expiry' => $driver->license_expiry ? $driver->license_expiry->format('Y-m-d') : null,
            'emergency_name' => $driver->emergency_name,
            'emergency_relation' => $driver->emergency_relation,
            'emergency_contact' => $driver->emergency_contact,
            'status' => $driver->status,
            'photo_url' => $driver->photo_url,
            'notes' => $driver->notes,
            'app_registered' => $driver->app_registered,
            'created_at' => $driver->created_at,
            'upcoming_schedules' => $upcomingSchedules,
            'completed_schedules' => $completedSchedules,
            'stats' => [
                'total_schedules' => $driver->schedules()->count(),
                'completed_schedules' => $driver->schedules()->where('status', 'completed')->count(),
                'active_schedules' => $driver->schedules()->where('status', 'active')->count(),
                'pending_schedules' => $driver->schedules()->where('status', 'scheduled')->count(),
            ]
        ]);
    }

    /**
     * Update driver
     */
    public function update(Request $request, $id)
    {
        $driver = Driver::findOrFail($id);

        if ($driver->user_id !== auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized action'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:drivers,email,' . $id,
            'contact_number' => 'required|string|max:20',
            'date_of_birth' => 'required|date|before:today', //   Must be in the past
            'gender' => 'required|string|in:male,female,other',
            'address' => 'required|string',
            'license_number' => 'required|string|unique:drivers,license_number,' . $id,
            'license_expiry' => 'required|date|after:today', //   Must be in the future
            'emergency_name' => 'string|max:255|nullable',
            'emergency_relation' => 'string|max:100|nullable',
            'emergency_contact' => 'string|max:20|nullable',
            'status' => 'required|string|in:active,inactive,pending,suspended',
            'photo' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $updateData = $request->only([
                'name', 'email', 'contact_number', 'date_of_birth', 'gender',
                'address', 'license_number', 'license_expiry', 'emergency_name',
                'emergency_relation', 'emergency_contact', 'status', 'notes'
            ]);

            // Handle photo upload
            if ($request->hasFile('photo')) {
                // Delete old photo if exists
                if ($driver->photo_url) {
                    $oldPhotoPath = public_path('storage/' . $driver->photo_url);
                    if (file_exists($oldPhotoPath)) {
                        unlink($oldPhotoPath);
                    }
                }

                $photo = $request->file('photo');
                $fileName = time() . '_' . uniqid() . '.' . $photo->getClientOriginalExtension();
                $photo->move(public_path('storage/drivers'), $fileName);
                $updateData['photo_url'] = 'drivers/' . $fileName;
            }

            //   Ensure user_id is not changed during update
            $updateData['user_id'] = $driver->user_id;

            $driver->update($updateData);

            Log::info('Driver updated successfully', [
                'driver_id' => $driver->id,
                'updated_fields' => array_keys($updateData)
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Driver updated successfully',
                'driver' => $driver
            ]);

        } catch (\Exception $e) {
            Log::error('Driver update error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update driver'
            ], 500);
        }
    }

    /**
     * Update driver status
     */
    public function updateStatus(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:active,inactive,pending,suspended'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $driver = Driver::findOrFail($id);
            $driver->update(['status' => $request->status]);

            return response()->json([
                'success' => true,
                'message' => 'Driver status updated successfully',
                'driver' => $driver
            ]);

        } catch (\Exception $e) {
            Log::error('Driver status update error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update driver status'
            ], 500);
        }
    }

    /**
     * Delete driver
     */
    public function destroy($id)
    {
        try {
            $driver = Driver::findOrFail($id);
            
            // Check if driver has active schedules
            $activeSchedules = $driver->schedules()
                ->whereIn('status', ['scheduled', 'active'])
                ->where('date', '>=', now()->toDateString())
                ->count();

            if ($activeSchedules > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete driver with active schedules'
                ], 400);
            }

            // Delete photo if exists
            if ($driver->photo_url) {
                $photoPath = public_path('storage/' . $driver->photo_url);
                if (file_exists($photoPath)) {
                    unlink($photoPath);
                }
            }

            $driver->delete();

            return response()->json([
                'success' => true,
                'message' => 'Driver deleted successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Driver deletion error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete driver'
            ], 500);
        }
    }

    /**
     * Get available drivers for scheduling
     */
    public function getAvailableDrivers(Request $request)
    {
        $date = $request->get('date', now()->toDateString());
        $startTime = $request->get('start_time');
        $endTime = $request->get('end_time');

        $availableDrivers = Driver::where('user_id', Auth::id())
            ->where('status', 'active')
            ->whereDoesntHave('schedules', function ($query) use ($date, $startTime, $endTime) {
                $query->where('date', $date)
                      ->where(function ($timeQuery) use ($startTime, $endTime) {
                          $timeQuery->whereBetween('start_time', [$startTime, $endTime])
                                   ->orWhereBetween('end_time', [$startTime, $endTime])
                                   ->orWhere(function ($overlapQuery) use ($startTime, $endTime) {
                                       $overlapQuery->where('start_time', '<=', $startTime)
                                                   ->where('end_time', '>=', $endTime);
                                   });
                      });
            })
            ->select('id', 'name', 'email', 'contact_number', 'license_number')
            ->get();

        return response()->json([
            'success' => true,
            'drivers' => $availableDrivers
        ]);
    }

    public function lookupByEmail(Request $request): JsonResponse
    {
        $email = $request->input('email');
        $driver = Driver::where('user_id', Auth::id())
            ->where('email', $email)->first();
        
        if (!$driver) {
            return response()->json(['success' => false], 404);
        }
        
        return response()->json([
            'success' => true,
            'driver' => ['id' => $driver->id, 'name' => $driver->name, 'email' => $driver->email]
        ]);
    }

    public function driversPanel()
    {
        try {
            $drivers = Driver::where('user_id', Auth::id())
                ->with(['schedules' => function($query) {
                $query->with(['route', 'bus'])->orderBy('date', 'desc');
            }])
            ->orderBy('created_at', 'desc')
            ->paginate(10);
            
            return view('panels.drivers', compact('drivers'));
            
        } catch (\Exception $e) {
            Log::error("Error loading drivers panel: " . $e->getMessage());
            
            return view('panels.drivers', [
                'drivers' => collect(),
                'error' => 'Error loading drivers data'
            ]);
        }
    }

    /**
     * Search drivers
     */
    public function search(Request $request)
    {
        $query = $request->get('query', '');
        $status = $request->get('status', '');

        $drivers = Driver::query()
            ->when($query, function ($q) use ($query) {
                $q->where('name', 'like', "%{$query}%")
                  ->orWhere('email', 'like', "%{$query}%")
                  ->orWhere('license_number', 'like', "%{$query}%");
            })
            ->when($status, function ($q) use ($status) {
                $q->where('status', $status);
            })
            ->select('id', 'name', 'email', 'contact_number', 'status', 'license_number')
            ->limit(20)
            ->get();

        return response()->json([
            'success' => true,
            'drivers' => $drivers
        ]);
    }

    /**
     * Driver profile view
     */
public function profile($id, Request $request)
{
    try {
        $driver = Driver::findOrFail($id);
        
        // Get filters
        $fromDate = $request->input('from_date');
        $toDate = $request->input('to_date');
        $routeId = $request->input('route_id');
        $busId = $request->input('bus_id');
        
        // Build schedules query
        $schedulesQuery = $driver->schedules()
                                ->with(['route', 'bus'])
                                ->orderBy('date', 'desc')
                                ->orderBy('start_time', 'desc');
        
        // Apply date filters
        if ($fromDate) {
            $schedulesQuery->where('date', '>=', $fromDate);
        }
        if ($toDate) {
            $schedulesQuery->where('date', '<=', $toDate);
        }
        
        // Apply route filter
        if ($routeId) {
            $schedulesQuery->where('route_id', $routeId);
        }
        
        // Apply bus filter
        if ($busId) {
            $schedulesQuery->where('bus_id', $busId);
        }
        
        // Get all schedules without filters for the dropdown options
        $allSchedules = $driver->schedules()->with(['route', 'bus'])->get();
        
        // Get unique routes
        $routes = [];
        foreach ($allSchedules as $schedule) {
            if ($schedule->route && $schedule->route->id && $schedule->route->name) {
                $routes[$schedule->route->id] = $schedule->route->name;
            }
        }
        
        // Get unique buses
        $buses = [];
        foreach ($allSchedules as $schedule) {
            if ($schedule->bus && $schedule->bus->id && $schedule->bus->bus_number) {
                $buses[$schedule->bus->id] = $schedule->bus->bus_number;
            }
        }
        
        // Paginate schedules (10 per page)
        $schedules = $schedulesQuery->paginate(10);
        
        // Use the existing profile.blade.php view
        return view('panels.profile', compact('driver', 'schedules', 'routes', 'buses'));
    } catch (\Exception $e) {
        \Log::error('Driver profile error: ' . $e->getMessage());
        return redirect()->route('drivers.panel')->with('error', 'Driver not found.');
    }
}

    // ===== MOBILE APP API METHODS =====

    /**
     * Register driver from mobile app - SINGLE METHOD WITH PHOTO SUPPORT
     */
    public function registerFromApp(Request $request)
    {
        try {
            Log::info('Driver registration attempt from mobile app', [
                'email' => $request->email,
                'name' => $request->name,
                'has_photo' => !empty($request->photo_base64)
            ]);

            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'email' => 'required|string|email|max:255|unique:drivers',
                'password' => 'required|string|min:6',
                'contact_number' => 'required|string|max:20',
                'date_of_birth' => 'required|date',
                'gender' => 'required|string|in:male,female,other',
                'address' => 'required|string',
                'license_number' => 'required|string|unique:drivers',
                'license_expiry' => 'required|date|after:today',
                'emergency_name' => 'required|string|max:255',
                'emergency_relation' => 'required|string|max:100',
                'emergency_contact' => 'required|string|max:20',
                'photo_base64' => 'nullable|string',
                'user_id' => 'required|exists:users,id',
            ]);

            if ($validator->fails()) {
                Log::warning('Driver registration validation failed', [
                    'errors' => $validator->errors(),
                    'email' => $request->email
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $photoUrl = null;

            // Handle photo upload if provided
            if ($request->has('photo_base64') && !empty($request->photo_base64)) {
                try {
                    Log::info('Processing photo upload for driver registration');
                    $photoUrl = $this->saveBase64Image($request->photo_base64, 'drivers');
                    Log::info('Photo uploaded successfully', ['photo_url' => $photoUrl]);
                } catch (\Exception $e) {
                    Log::error('Photo upload error during registration', [
                        'error' => $e->getMessage(),
                        'email' => $request->email
                    ]);
                    // Continue without photo if upload fails
                }
            }

            $driver = Driver::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'contact_number' => $request->contact_number,
                'date_of_birth' => $request->date_of_birth,
                'gender' => $request->gender,
                'address' => $request->address,
                'license_number' => $request->license_number,
                'license_expiry' => $request->license_expiry,
                'emergency_name' => $request->emergency_name,
                'emergency_relation' => $request->emergency_relation,
                'emergency_contact' => $request->emergency_contact,
                'photo_url' => $photoUrl,
                'status' => 'pending', 
                'user_id' => $request->user_id,
                'app_registered' => true,
                'registration_source' => 'mobile_app'
            ]);

            Log::info('Driver registered successfully from mobile app', [
                'driver_id' => $driver->id,
                'email' => $driver->email,
                'name' => $driver->name,
                'has_photo' => !empty($photoUrl)
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Driver registration successful. Waiting for approval.',
                'driver_id' => $driver->id,
                'driver' => [
                    'id' => $driver->id,
                    'name' => $driver->name,
                    'email' => $driver->email,
                    'status' => $driver->status,
                    'photo_url' => $photoUrl
                ]
            ], 201);

        } catch (\Exception $e) {
            Log::error('Driver registration error from mobile app', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->except(['password', 'photo_base64'])
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Registration failed. Please try again.'
            ], 500);
        }
    }

    /**
     * Helper method to save base64 image
     */
    private function saveBase64Image($base64String, $folder = 'uploads')
    {
        try {
            // Extract the image data
            if (preg_match('/^data:image\/(\w+);base64,/', $base64String, $type)) {
                $imageData = substr($base64String, strpos($base64String, ',') + 1);
                $type = strtolower($type[1]); // jpg, png, gif
                
                if (!in_array($type, ['jpg', 'jpeg', 'png', 'gif'])) {
                    throw new \Exception('Invalid image type: ' . $type);
                }
                
                $imageData = base64_decode($imageData);
                
                if ($imageData === false) {
                    throw new \Exception('Base64 decode failed');
                }
                
                // Generate unique filename
                $fileName = time() . '_' . uniqid() . '.' . $type;
                $filePath = $folder . "/" . $fileName;
                $fullPath = public_path('storage/' . $filePath);
                
                // Create directory if it doesn't exist
                $directory = dirname($fullPath);
                if (!file_exists($directory)) {
                    mkdir($directory, 0755, true);
                }
                
                // Save the file
                if (file_put_contents($fullPath, $imageData)) {
                    Log::info('Base64 image saved successfully', [
                        'file_path' => $filePath,
                        'file_size' => strlen($imageData)
                    ]);
                    return $filePath; // Return relative path
                } else {
                    throw new \Exception('Failed to save image to disk');
                }
            } else {
                throw new \Exception('Invalid base64 image string format');
            }
        } catch (\Exception $e) {
            Log::error('Base64 image save error', [
                'error' => $e->getMessage(),
                'folder' => $folder
            ]);
            throw $e;
        }
    }

    /**
     * Login driver from mobile app
     */
    public function loginFromApp(Request $request)
    {
        Log::info('===== DRIVER LOGIN ATTEMPT =====', [
            'email' => $request->email,
            'timestamp' => now()
        ]);

        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string'
        ]);
        
        if ($validator->fails()) {
            Log::warning('Validation failed', ['errors' => $validator->errors()]);
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $driver = Driver::where('email', $request->email)->first();
        
        if (!$driver) {
            Log::warning('❌ Driver not found', ['email' => $request->email]);
            return response()->json([
                'success' => false,
                'message' => 'Invalid email or password'
            ], 401);
        }

        Log::info('  Driver found', [
            'driver_id' => $driver->id,
            'driver_name' => $driver->name,
            'driver_email' => $driver->email,
            'driver_status' => $driver->status,
            'password_hash' => substr($driver->password, 0, 20) . '...',
            'provided_password' => str_repeat('*', strlen($request->password))
        ]);

        if (!Hash::check($request->password, $driver->password)) {
            Log::warning('❌ Password does not match', [
                'email' => $request->email,
                'provided_password_length' => strlen($request->password),
                'stored_hash_length' => strlen($driver->password)
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Invalid email or password'
            ], 401);
        }

        Log::info('  Password verified');

        // Check if driver is active
        if ($driver->status !== 'active') {
            Log::warning('❌ Driver not active', [
                'email' => $driver->email,
                'status' => $driver->status
            ]);
            return response()->json([
                'success' => false,
                'message' => "Your account is {$driver->status}. Please wait for approval from bus operator."
            ], 403);
        }

        Log::info('  Login successful', [
            'driver_id' => $driver->id,
            'driver_name' => $driver->name
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'driver' => [
                'id' => $driver->id,
                'name' => $driver->name,
                'email' => $driver->email,
                'status' => $driver->status
            ]
        ]);
    }

    /**
     * Get driver schedules for mobile app
     */
    public function getDriverSchedules($driverId)
    {
        try {
            $driver = Driver::find($driverId);
            
            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver not found'
                ], 404);
            }

            $schedules = Schedule::with(['route', 'bus'])
                ->where('driver_id', $driverId)
                ->where('date', '>=', now()->toDateString())
                ->orderBy('date')
                ->orderBy('start_time')
                ->get();

            return response()->json([
                'success' => true,
                'schedules' => $schedules->map(function ($schedule) {
                    return [
                        'id' => $schedule->id,
                        'date' => $schedule->date,
                        'start_time' => $schedule->start_time,
                        'end_time' => $schedule->end_time,
                        'status' => $schedule->status,
                        'fare_regular' => $schedule->fare_regular,
                        'fare_aircon' => $schedule->fare_aircon,
                        'route' => [
                            'id' => $schedule->route->id,
                            'name' => $schedule->route->name,
                            'start_location' => $schedule->route->start_location,
                            'end_location' => $schedule->route->end_location,
                        ],
                        'bus' => [
                            'id' => $schedule->bus->id,
                            'bus_number' => $schedule->bus->bus_number,
                            'plate_number' => $schedule->bus->plate_number,
                        ]
                    ];
                })
            ], 200);

        } catch (\Exception $e) {
            Log::error('Get driver schedules error', [
                'driver_id' => $driverId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to load schedules'
            ], 500);
        }
    }

    /**
     * Get driver profile for mobile app
     */
    public function getProfile($driverId)
    {
        try {
            $driver = Driver::find($driverId);
            
            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'driver' => [
                    'id' => $driver->id,
                    'name' => $driver->name,
                    'email' => $driver->email,
                    'contact_number' => $driver->contact_number,
                    'date_of_birth' => $driver->date_of_birth,
                    'gender' => $driver->gender,
                    'address' => $driver->address,
                    'license_number' => $driver->license_number,
                    'license_expiry' => $driver->license_expiry,
                    'emergency_name' => $driver->emergency_name,
                    'emergency_relation' => $driver->emergency_relation,
                    'emergency_contact' => $driver->emergency_contact,
                    'status' => $driver->status,
                    'photo_url' => $driver->photo_url
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Get driver profile error', [
                'driver_id' => $driverId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to load profile'
            ], 500);
        }
    }

    /**
     * Update driver profile from mobile app
     */
    public function updateProfile(Request $request, $driverId)
    {
        try {
            $driver = Driver::find($driverId);
            
            if (!$driver) {
                return response()->json([
                    'success' => false,
                    'message' => 'Driver not found'
                ], 404);
            }

            $validator = Validator::make($request->all(), [
                'contact_number' => 'string|max:20',
                'address' => 'string',
                'emergency_name' => 'string|max:255',
                'emergency_relation' => 'string|max:100',
                'emergency_contact' => 'string|max:20',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $driver->update($request->only([
                'contact_number', 'address', 'emergency_name', 
                'emergency_relation', 'emergency_contact'
            ]));

            return response()->json([
                'success' => true,
                'message' => 'Profile updated successfully',
                'driver' => [
                    'id' => $driver->id,
                    'name' => $driver->name,
                    'email' => $driver->email,
                    'contact_number' => $driver->contact_number,
                    'address' => $driver->address,
                    'emergency_name' => $driver->emergency_name,
                    'emergency_relation' => $driver->emergency_relation,
                    'emergency_contact' => $driver->emergency_contact,
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Update driver profile error', [
                'driver_id' => $driverId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update profile'
            ], 500);
        }
    }

    /**
     * Update schedule status from mobile app
     */
    public function updateScheduleStatus(Request $request, $driverId, $scheduleId)
    {
        try {
            $validator = Validator::make($request->all(), [
                'status' => 'required|string|in:accepted,declined,started,completed'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid status',
                    'errors' => $validator->errors()
                ], 422);
            }

            $schedule = Schedule::where('id', $scheduleId)
                ->where('driver_id', $driverId)
                ->first();

            if (!$schedule) {
                return response()->json([
                    'success' => false,
                    'message' => 'Schedule not found'
                ], 404);
            }

            $schedule->update(['status' => $request->status]);

            return response()->json([
                'success' => true,
                'message' => 'Schedule status updated successfully',
                'schedule' => [
                    'id' => $schedule->id,
                    'status' => $schedule->status,
                    'date' => $schedule->date,
                    'start_time' => $schedule->start_time,
                    'end_time' => $schedule->end_time
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Update schedule status error', [
                'driver_id' => $driverId,
                'schedule_id' => $scheduleId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update schedule status'
            ], 500);
        }
    }

    /**
     * Reset driver password
     */
    public function resetPassword(Request $request, $id)
    {
        try {
            $driver = Driver::findOrFail($id);
            
            $newPassword = 'driver123'; // Default password
            if ($request->has('password')) {
                $newPassword = $request->password;
            }

            $driver->update(['password' => Hash::make($newPassword)]);

            return response()->json([
                'success' => true,
                'message' => 'Password reset successfully',
                'new_password' => $newPassword
            ]);

        } catch (\Exception $e) {
            Log::error('Password reset error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to reset password'
            ], 500);
        }
    }
}