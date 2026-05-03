<?php

namespace App\Http\Controllers;

use App\Models\Bus;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth; 

class BusController extends Controller
{
    /**
     * Display buses panel with terminal filtering
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        if (!$user || $user->terminal === null) {
            abort(403, 'Access denied. Terminal not assigned.');
        }

        $operatorTerminal = $user->terminal;

        // Build query with user_id filtering (multi-tenant isolation)
        $query = Bus::with(['schedules' => function($query) {
             $query->where('date', '>=', now()->toDateString())
                   ->orderBy('date')
                   ->orderBy('start_time');
         }])->where('user_id', Auth::id())
           ->where('terminal', $operatorTerminal);

        // Apply search filters
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function($q) use ($search) {
                $q->where('bus_number', 'like', "%{$search}%")
                  ->orWhere('plate_number', 'like', "%{$search}%")
                  ->orWhere('model', 'like', "%{$search}%")
                  ->orWhere('bus_company', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->get('status'));
        }

        if ($request->filled('accommodation_type')) {
            $query->where('accommodation_type', $request->get('accommodation_type'));
        }

        $buses = $query->orderBy('created_at', 'desc')->paginate(15);

        // User-specific statistics (multi-tenant safe)
        $stats = [
            'total_buses' => Bus::where('user_id', Auth::id())->where('terminal', $operatorTerminal)->count(),
            'available_buses' => Bus::where('user_id', Auth::id())->where('status', 'available')->where('terminal', $operatorTerminal)->count(),
            'in_service_buses' => Bus::where('user_id', Auth::id())->where('status', 'in_service')->where('terminal', $operatorTerminal)->count(),
            'maintenance_buses' => Bus::where('user_id', Auth::id())->where('status', 'maintenance')->where('terminal', $operatorTerminal)->count(),
        ];

        return view('panels.buses', compact('buses', 'stats'));
    }

    /**
     * Store a new bus
     */
    public function store(Request $request)
    {
        $user = Auth::user();
        if (!$user || $user->terminal === null) {
            return response()->json(['success' => false, 'message' => 'Access denied. Terminal not assigned.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'plate_number' => 'required|string|max:20|unique:buses',
            'bus_number' => 'required|string|max:20|unique:buses',
            'model' => 'required|string|max:100',
            'capacity' => 'required|integer|min:1',
            'accommodation_type' => 'required|in:regular,air-conditioned',
            'status' => 'required|in:available,in_service,maintenance,out_of_service',
            'description' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            //   FIX: Explicitly set user_id in the array
            $busData = [
                'user_id' => $user->id,
                'plate_number' => $request->plate_number,
                'bus_number' => $request->bus_number,
                'model' => $request->model,
                'capacity' => $request->capacity,
                'accommodation_type' => $request->accommodation_type,
                'status' => $request->status,
                'terminal' => $user->terminal,
                'bus_company' => $user->company_name,
                'description' => $request->description,
            ];

            \Log::info('Creating bus with data:', $busData); //   Debug log

            $bus = Bus::create($busData);

            return response()->json([
                'success' => true,
                'message' => 'Bus added successfully',
                'bus' => $bus
            ]);
        } catch (\Exception $e) {
            Log::error('Bus creation error: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString()); //   More detailed error
            return response()->json(['success' => false, 'message' => 'Failed to add bus: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Show bus details (with terminal check)
     */
    public function show($id)
    {
        try {
            $user = Auth::user();
            $bus = Bus::with(['schedules.driver', 'schedules.route'])
                     ->where('user_id', $user->id)
                     ->where('terminal', $user->terminal)
                     ->findOrFail($id);

            return response()->json([
                'success' => true,
                'id' => $bus->id,
                'bus_number' => $bus->bus_number,
                'plate_number' => $bus->plate_number,
                'model' => $bus->model,
                'capacity' => $bus->capacity,
                'bus_company' => $bus->bus_company,
                'accommodation_type' => $bus->accommodation_type,
                'status' => $bus->status,
                'terminal' => $bus->terminal,
                'description' => $bus->description,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bus not found'
            ], 404);
        }
    }

    /**
     * Update bus (with terminal check)
     */
    public function update(Request $request, $id)
    {
        $user = Auth::user();
        if (!$user || $user->terminal === null) {
            return response()->json(['success' => false, 'message' => 'Access denied. Terminal not assigned.'], 403);
        }

        $bus = Bus::where('user_id', $user->id)->where('terminal', $user->terminal)->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'bus_number' => 'required|string|max:20|unique:buses,bus_number,' . $id,
            'plate_number' => 'required|string|max:20|unique:buses,plate_number,' . $id,
            'model' => 'required|string|max:100',
            'capacity' => 'required|integer|min:1',
            'bus_company' => 'nullable|string|max:100',
            'accommodation_type' => 'required|in:regular,air-conditioned',
            'status' => 'required|in:available,in_service,maintenance,out_of_service',
            'description' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Keep the existing terminal, don't allow changing it
            $busData = $request->all();
            unset($busData['terminal']); // Remove terminal from update data
            
            $bus->update($busData);

            return response()->json([
                'success' => true,
                'message' => 'Bus updated successfully',
                'bus' => $bus
            ]);
        } catch (\Exception $e) {
            Log::error('Bus update error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to update bus'], 500);
        }
    }

    /**
     * Delete bus (with terminal check)
     */
    public function destroy($id)
    {
        $user = Auth::user();
        if (!$user || $user->terminal === null) {
            return response()->json(['success' => false, 'message' => 'Access denied. Terminal not assigned.'], 403);
        }

        $bus = Bus::where('user_id', $user->id)->where('terminal', $user->terminal)->findOrFail($id);

        try {
            $activeSchedules = $bus->schedules()
                                  ->whereIn('status', ['scheduled', 'active'])
                                  ->where('date', '>=', now()->toDateString())
                                  ->count();

            if ($activeSchedules > 0) {
                return response()->json(['success' => false, 'message' => 'Cannot delete bus with active schedules'], 400);
            }

            $bus->delete();

            return response()->json(['success' => true, 'message' => 'Bus deleted successfully']);
        } catch (\Exception $e) {
            Log::error('Bus deletion error: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to delete bus'], 500);
        }
    }

    // ===== API METHODS FOR MOBILE APP =====

    /**
     * Get all buses for mobile app
     */
    public function apiIndex()
    {
        try {
            $buses = Bus::where('user_id', Auth::id())
                ->whereIn('status', ['available', 'in_service'])
                ->select('id', 'bus_number', 'plate_number', 'capacity', 'bus_type', 'status')
                ->orderBy('bus_number')
                ->get();

            return response()->json([
                'success' => true,
                'buses' => $buses
            ], 200);

        } catch (\Exception $e) {
            Log::error('Get buses API error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to load buses'
            ], 500);
        }
    }

    /**
     * Get bus details for mobile app
     */
    public function apiShow($id)
    {
        try {
            $bus = Bus::where('user_id', Auth::id())
                ->whereIn('status', ['available', 'in_service'])
                ->select('id', 'bus_number', 'plate_number', 'capacity', 'bus_type', 'manufacturer', 'model', 'year', 'status')
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'bus' => $bus
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bus not found'
            ], 404);
        }
    }

    /**
     * Get available buses for scheduling
     */
    public function getAvailableBuses(Request $request)
    {
        $user = Auth::user();
        $date = $request->get('date', now()->toDateString());
        $startTime = $request->get('start_time');
        $endTime = $request->get('end_time');
        $excludeScheduleId = $request->get('exclude_schedule_id');

        $query = Bus::where('user_id', $user->id)
            ->where('status', 'available')
            ->where('terminal', $user->terminal)
            ->whereDoesntHave('schedules', function ($scheduleQuery) use ($date, $startTime, $endTime, $excludeScheduleId) {
                $scheduleQuery->where('date', $date)
                      ->where(function ($timeQuery) use ($startTime, $endTime) {
                          $timeQuery->whereBetween('start_time', [$startTime, $endTime])
                                   ->orWhereBetween('end_time', [$startTime, $endTime])
                                   ->orWhere(function ($overlapQuery) use ($startTime, $endTime) {
                                       $overlapQuery->where('start_time', '<=', $startTime)
                                                   ->where('end_time', '>=', $endTime);
                                   });
                      });
                
                if ($excludeScheduleId) {
                    $scheduleQuery->where('id', '!=', $excludeScheduleId);
                }
            });

        $availableBuses = $query->select('id', 'bus_number', 'plate_number', 'capacity', 'accommodation_type')->get();

        return response()->json([
            'success' => true,
            'buses' => $availableBuses
        ]);
    }

    /**
     * Search buses
     */
    public function search(Request $request)
    {
        $query = $request->get('query', '');
        $status = $request->get('status', '');
        $busType = $request->get('bus_type', '');

        $buses = Bus::where('user_id', Auth::id())
            ->when($query, function ($q) use ($query) {
                $q->where('bus_number', 'like', "%{$query}%")
                  ->orWhere('plate_number', 'like', "%{$query}%");
            })
            ->when($status, function ($q) use ($status) {
                $q->where('status', $status);
            })
            ->when($busType, function ($q) use ($busType) {
                $q->where('bus_type', $busType);
            })
            ->select('id', 'bus_number', 'plate_number', 'capacity', 'bus_type', 'status')
            ->limit(20)
            ->get();

        return response()->json([
            'success' => true,
            'buses' => $buses
        ]);
    }

    /**
     * Get bus statistics
     */
    public function getBusStats()
    {
        $user = Auth::user();
        $terminal = $user->terminal;

        $stats = [
            'total_buses' => Bus::where('user_id', $user->id)->where('terminal', $terminal)->count(),
            'available_buses' => Bus::where('user_id', $user->id)->where('status', 'available')->where('terminal', $terminal)->count(),
            'in_service_buses' => Bus::where('user_id', $user->id)->where('status', 'in_service')->where('terminal', $terminal)->count(),
            'maintenance_buses' => Bus::where('user_id', $user->id)->where('status', 'maintenance')->where('terminal', $terminal)->count(),
            'out_of_service_buses' => Bus::where('user_id', $user->id)->where('status', 'out_of_service')->where('terminal', $terminal)->count(),
            'regular_buses' => Bus::where('user_id', $user->id)->where('accommodation_type', 'regular')->where('terminal', $terminal)->count(),
            'aircon_buses' => Bus::where('user_id', $user->id)->where('accommodation_type', 'air-conditioned')->where('terminal', $terminal)->count(),
            'total_capacity' => Bus::where('user_id', $user->id)->where('terminal', $terminal)->sum('capacity'),
            'average_capacity' => Bus::where('user_id', $user->id)->where('terminal', $terminal)->avg('capacity'),
        ];

        return response()->json([
            'success' => true,
            'stats' => $stats,
            'terminal' => ucfirst($terminal) . ' Terminal'
        ]);
    }
}