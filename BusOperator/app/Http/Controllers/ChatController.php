<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use GetStream\StreamChat\Client as StreamChat;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Handler\CurlHandler;

class ChatController extends Controller
{
    protected $streamClient;

    public function __construct()
    {
        $apiKey = (string) env('STREAM_API_KEY', '');
        $apiSecret = (string) env('STREAM_API_SECRET', '');

        $this->streamClient = null;

        if ($apiKey !== '' && $apiSecret !== '') {
            try {
                // Create Guzzle client with SSL verification disabled for development
                if (config('app.debug')) {
                    // For development, disable SSL verification
                    $handler = new CurlHandler();
                    $stack = HandlerStack::create($handler);
                    $guzzleClient = new GuzzleClient([
                        'handler' => $stack,
                        'verify' => false,
                        'http_errors' => false,
                    ]);
                    
                    // Try to instantiate StreamChat with custom client
                    // Note: This may vary by SDK version
                    try {
                        $this->streamClient = new StreamChat($apiKey, $apiSecret);
                        // Attempt to set the client via reflection if possible
                        $this->configureStreamClientSSL($this->streamClient, $guzzleClient);
                    } catch (\Throwable $e) {
                        Log::warning('Could not configure custom Guzzle client', ['error' => $e->getMessage()]);
                        // Fall back to default client
                        $this->streamClient = new StreamChat($apiKey, $apiSecret);
                    }
                } else {
                    $this->streamClient = new StreamChat($apiKey, $apiSecret);
                }
            } catch (\Throwable $e) {
                Log::error('Failed to initialize Stream Chat client', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                $this->streamClient = null;
            }
        }
    }

    /**
     * Attempt to configure SSL verification in StreamChat client
     */
    private function configureStreamClientSSL($streamClient, $guzzleClient)
    {
        try {
            $reflection = new \ReflectionObject($streamClient);
            $properties = $reflection->getProperties();
            
            foreach ($properties as $property) {
                $property->setAccessible(true);
                $value = $property->getValue($streamClient);
                
                // Look for HTTP client property
                if ($value instanceof \GuzzleHttp\ClientInterface || 
                    (is_object($value) && strpos(get_class($value), 'Client') !== false)) {
                    $property->setValue($streamClient, $guzzleClient);
                    Log::debug('Successfully configured custom Guzzle client in StreamChat');
                    return;
                }
            }
        } catch (\Throwable $e) {
            Log::debug('Could not configure SSL via reflection', ['error' => $e->getMessage()]);
        }
    }

    public function index()
    {
        /** @var User */
        $user = Auth::user();

        $streamApiKey = (string) env('STREAM_API_KEY', '');
        $streamToken = '';
        $streamUnavailable = false;

        if (!$this->streamClient || $streamApiKey === '') {
            $streamUnavailable = true;
        } else {
            try {
                $this->streamClient->upsertUser($user->getStreamUserData());
                $streamToken = $user->getStreamToken();
                Log::info('Stream Chat initialized successfully for user: ' . $user->id);
            } catch (\Throwable $e) {
                Log::error('Stream chat error in ChatController@index', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                // Still attempt to generate token even if upsert fails
                try {
                    $streamToken = $user->getStreamToken();
                } catch (\Throwable $tokenError) {
                    Log::error('Failed to generate Stream token', ['error' => $tokenError->getMessage()]);
                    $streamUnavailable = true;
                }
            }
        }

        return view('panels.chat', [
            'streamApiKey' => $streamApiKey,
            'streamToken' => $streamToken,
            'userId' => (string)$user->id,
            'userName' => $user->name,
            'streamUnavailable' => $streamUnavailable,
        ]);
    }

    public function createChannel(Request $request)
    {
        $request->validate([
            'type' => 'required|string',
            'id' => 'required|string',
            'name' => 'required|string',
            'members' => 'required|array',
        ]);

        if (!$this->streamClient) {
            return response()->json([
                'success' => false,
                'error' => 'Chat service is currently unavailable.'
            ], 503);
        }

        try {
            $currentUserId = (string)Auth::id();
            
            // Build member IDs list - include all selected members plus creator
            $selectedMemberIds = collect($request->members)
                ->map(fn($memberId) => (string) $memberId)
                ->values();
            
            // Only add current user if not already in the selection
            $memberIds = $selectedMemberIds->contains($currentUserId)
                ? $selectedMemberIds
                : $selectedMemberIds->push($currentUserId);
            
            $memberIds = $memberIds->unique()->values();

            Log::info('Creating channel', [
                'channel_id' => $request->id,
                'channel_name' => $request->name,
                'selected_members' => $selectedMemberIds->all(),
                'final_members' => $memberIds->all(),
                'creator_id' => $currentUserId,
            ]);

            // Get users from database with fallback
            try {
                $managerUsers = User::whereIn('id', $memberIds)->get();
            } catch (\Throwable $e) {
                Log::error('Error fetching manager users', ['error' => $e->getMessage()]);
                $managerUsers = collect([]);
            }

            try {
                $operatorUsers = DB::table('users')
                    ->whereIn('id', $memberIds)
                    ->where('role', 'bus_operator')
                    ->get();
            } catch (\Throwable $e) {
                Log::error('Error fetching operator users', ['error' => $e->getMessage()]);
                $operatorUsers = collect([]);
            }

            $streamUsers = [];

            foreach ($managerUsers as $user) {
                $streamUsers[] = $user->getStreamUserData();
            }

            foreach ($operatorUsers as $user) {
                $streamUsers[] = [
                    'id' => (string) $user->id,
                    'name' => $user->name,
                    'role' => 'user',
                    'image' => $user->photo_url ?? null,
                ];
            }

            if (!empty($streamUsers)) {
                try {
                    $this->streamClient->upsertUsers($streamUsers);
                } catch (\Throwable $e) {
                    Log::error('Error upserting users to Stream', ['error' => $e->getMessage()]);
                    // Continue anyway - users might already exist
                }
            }

            try {
                $channel = $this->streamClient->channel(
                    $request->type,
                    $request->id,
                    [
                        'name' => $request->name,
                        'created_by' => ['id' => $currentUserId],
                        'members' => $memberIds->all(),
                    ]
                );

                // Create the channel with the current user as creator
                $channel->create($currentUserId);

                Log::info('Channel created successfully', [
                    'channel_id' => $channel->id,
                    'creator_id' => $currentUserId,
                    'member_count' => count($memberIds->all()),
                ]);

                return response()->json([
                    'success' => true,
                    'channel' => [
                        'id' => $channel->id,
                        'type' => $request->type,
                    ]
                ]);
            } catch (\Throwable $e) {
                Log::error('Stream channel creation error', ['error' => $e->getMessage()]);
                throw $e;
            }
        } catch (\Throwable $e) {
            Log::error('Create channel error', [
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            return response()->json([
                'success' => false,
                'error' => 'Failed to create channel: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getUsers()
    {
        try {
            $currentUser = Auth::user();
            
            if (!$currentUser) {
                return response()->json(['error' => 'Not authenticated'], 401);
            }

            // Get bus operators
            $busOperators = [];
            $operatorRows = DB::table('users')
                ->where('role', 'bus_operator')
                ->select(['id', 'name', 'photo_url', 'role', 'company_name'])
                ->get();

            foreach ($operatorRows as $user) {
                $busOperators[] = [
                    'id' => (int) $user->id,
                    'name' => $user->name ?? 'Unknown',
                    'photo_url' => $user->photo_url,
                    'role' => $user->role,
                    'formatted_role' => 'Bus Operator',
                    'source' => 'bus_operator',
                ];
            }

            // Get managers
            $managers = [];
            $managerRows = User::where('id', '!=', $currentUser->id)
                ->select(['id', 'name', 'photo_url', 'role', 'terminal'])
                ->get();

            foreach ($managerRows as $user) {
                $managers[] = [
                    'id' => (int) $user->id,
                    'name' => $user->name,
                    'photo_url' => $user->photo_url,
                    'role' => $user->role,
                    'formatted_role' => isset($user->formatted_role) ? $user->formatted_role : 'Manager',
                    'source' => 'manager',
                ];
            }

            $users = array_merge($managers, $busOperators);

            Log::info('Users loaded successfully', [
                'current_user_id' => $currentUser->id,
                'manager_count' => count($managers),
                'operator_count' => count($busOperators),
                'total_count' => count($users),
            ]);

            return response()->json($users, 200);
        } catch (\Throwable $e) {
            Log::error('Error in ChatController::getUsers', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            return response()->json(['error' => 'Failed to load users'], 500);
        }
    }

    public function registerUsers(Request $request)
    {
        $request->validate([
            'user_ids' => 'required|array',
        ]);

        if (!$this->streamClient) {
            return response()->json([
                'success' => false,
                'error' => 'Chat service is currently unavailable.'
            ], 503);
        }

        try {
            try {
                $managerUsers = User::whereIn('id', $request->user_ids)->get();
            } catch (\Throwable $e) {
                Log::error('Error fetching manager users for registration', ['error' => $e->getMessage()]);
                $managerUsers = collect([]);
            }

            try {
                $operatorUsers = DB::table('users')
                    ->whereIn('id', $request->user_ids)
                    ->where('role', 'bus_operator')
                    ->get();
            } catch (\Throwable $e) {
                Log::error('Error fetching operator users for registration', ['error' => $e->getMessage()]);
                $operatorUsers = collect([]);
            }

            $streamUsers = [];

            foreach ($managerUsers as $user) {
                $streamUsers[] = $user->getStreamUserData();
            }

            foreach ($operatorUsers as $user) {
                $streamUsers[] = [
                    'id' => (string) $user->id,
                    'name' => $user->name,
                    'role' => 'user',
                    'image' => $user->photo_url ?? null,
                ];
            }

            // Upsert users in Stream (server-side)
            if (!empty($streamUsers)) {
                try {
                    $this->streamClient->upsertUsers($streamUsers);
                } catch (\Throwable $e) {
                    Log::error('Error upserting users in registerUsers', ['error' => $e->getMessage()]);
                    throw $e;
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Users registered successfully!'
            ]);
        } catch (\Throwable $e) {
            Log::error('Register users error', [
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
