<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Driver;
use GetStream\StreamChat\Client as StreamChat;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\HandlerStack;
use App\Support\PublicMediaUrl;
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
                if (config('app.debug')) {
                    $handler = new CurlHandler();
                    $stack = HandlerStack::create($handler);
                    $guzzleClient = new GuzzleClient([
                        'handler' => $stack,
                        'verify' => false,
                        'http_errors' => false,
                    ]);
                    
                   
                    try {
                        $this->streamClient = new StreamChat($apiKey, $apiSecret);
                        $this->configureStreamClientSSL($this->streamClient, $guzzleClient);
                    } catch (\Throwable $e) {
                        Log::warning('Could not configure custom Guzzle client', ['error' => $e->getMessage()]);
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
            'userId' => $user->streamUserId(),
            'userName' => $user->name,
            'streamUnavailable' => $streamUnavailable,
        ]);
    }

    /**
     * @param  iterable<string|int>  $memberIds
     * @return array{0: array<int>, 1: array<int>} [users.id list, managers.id list for terminal managers]
     */
    private function parseStreamMemberIds(iterable $memberIds): array
    {
        $userIds = [];
        $terminalManagerIds = [];
        foreach ($memberIds as $raw) {
            $s = (string) $raw;
            if (preg_match('/^u_(\d+)$/', $s, $m)) {
                $userIds[] = (int) $m[1];
            } elseif (preg_match('/^m_(\d+)$/', $s, $m)) {
                $terminalManagerIds[] = (int) $m[1];
            } elseif (ctype_digit($s)) {
                // Legacy panel payloads (users table only)
                $userIds[] = (int) $s;
            }
        }

        return [array_values(array_unique($userIds)), array_values(array_unique($terminalManagerIds))];
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
            $currentStreamId = Auth::user()->streamUserId();

            // Build member IDs list - include all selected members plus creator (Stream string ids)
            $selectedMemberIds = collect($request->members)
                ->map(fn ($memberId) => (string) $memberId)
                ->values();

            $memberIds = $selectedMemberIds->contains($currentStreamId)
                ? $selectedMemberIds
                : $selectedMemberIds->push($currentStreamId);

            $memberIds = $memberIds->unique()->values();

            Log::info('Creating channel', [
                'channel_id' => $request->id,
                'channel_name' => $request->name,
                'selected_members' => $selectedMemberIds->all(),
                'final_members' => $memberIds->all(),
                'creator_id' => $currentStreamId,
            ]);

            [$userTableIds, $terminalManagerIds] = $this->parseStreamMemberIds($memberIds);

            $streamUsers = [];

            try {
                if (! empty($userTableIds)) {
                    foreach (User::whereIn('id', $userTableIds)->get() as $user) {
                        $streamUsers[] = $user->getStreamUserData();
                    }
                }
            } catch (\Throwable $e) {
                Log::error('Error fetching users for Stream upsert', ['error' => $e->getMessage()]);
            }

            try {
                if (! empty($terminalManagerIds)) {
                    foreach (DB::table('managers')->whereIn('id', $terminalManagerIds)->get() as $mgr) {
                        $streamUsers[] = [
                            'id' => 'm_'.$mgr->id,
                            'name' => $mgr->name ?? trim(($mgr->first_name ?? '').' '.($mgr->last_name ?? '')),
                            'role' => 'user',
                            'image' => PublicMediaUrl::forProfilePhoto($mgr->photo_url),
                        ];
                    }
                }
            } catch (\Throwable $e) {
                Log::error('Error fetching terminal managers for Stream upsert', ['error' => $e->getMessage()]);
            }

            if (! empty($streamUsers)) {
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
                        'created_by' => ['id' => $currentStreamId],
                        'members' => $memberIds->all(),
                    ]
                );

                // Create the channel with the current user as creator
                $channel->create($currentStreamId);

                Log::info('Channel created successfully', [
                    'channel_id' => $channel->id,
                    'creator_id' => $currentStreamId,
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
                    'id' => 'u_'.$user->id,
                    'name' => $user->name ?? 'Unknown',
                    'photo_url' => PublicMediaUrl::forProfilePhoto($user->photo_url),
                    'role' => $user->role,
                    'formatted_role' => 'Bus Operator',
                    'source' => 'bus_operator',
                ];
            }

            // Terminal managers live in `managers` (TerminalManager DB), not `users`.
            $managers = [];
            $managerRows = DB::table('managers')
                ->where('status', 'active')
                ->select(['id', 'name', 'first_name', 'last_name', 'photo_url', 'role', 'terminal'])
                ->get();

            foreach ($managerRows as $mgr) {
                $managers[] = [
                    'id' => 'm_'.$mgr->id,
                    'name' => $mgr->name ?? trim(($mgr->first_name ?? '').' '.($mgr->last_name ?? '')),
                    'photo_url' => PublicMediaUrl::forProfilePhoto($mgr->photo_url),
                    'role' => $mgr->role ?? 'terminalManager',
                    'formatted_role' => 'Terminal Manager',
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

    public function driverStreamToken(Request $request)
    {
        $driverId = $request->query('driver_id');
        if (!$driverId) {
            return response()->json(['success' => false, 'message' => 'driver_id required'], 400);
        }

        if (!$this->streamClient) {
            return response()->json(['success' => false, 'message' => 'Chat service unavailable'], 503);
        }

        $driver = Driver::with('user')->find($driverId);
        if (!$driver) {
            return response()->json(['success' => false, 'message' => 'Driver not found'], 404);
        }

        $streamUserId = 'driver_' . $driver->id;

        try {
            $this->streamClient->upsertUser([
                'id'   => $streamUserId,
                'name' => $driver->name,
                'role' => 'user',
                'image' => PublicMediaUrl::forProfilePhoto($driver->photo_url),
            ]);

            // Also ensure the operator is in Stream
            if ($driver->user) {
                $this->streamClient->upsertUser([
                    'id' => $driver->user->streamUserId(),
                    'name' => $driver->user->name,
                    'role' => 'user',
                ]);
            }

            $token = $this->streamClient->createToken($streamUserId);

            return response()->json([
                'success'       => true,
                'stream_api_key' => env('STREAM_API_KEY'),
                'token'         => $token,
                'user_id'       => $streamUserId,
                'user_name'     => $driver->name,
                'operator_id'   => $driver->user ? $driver->user->streamUserId() : '',
                'operator_name' => $driver->user ? ($driver->user->name ?? 'Operator') : 'Operator',
            ]);
        } catch (\Throwable $e) {
            Log::error('driverStreamToken error', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
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
                [$userTableIds, $terminalManagerIds] = $this->parseStreamMemberIds($request->user_ids);
            } catch (\Throwable $e) {
                Log::error('Error parsing Stream member ids for registration', ['error' => $e->getMessage()]);
                $userTableIds = [];
                $terminalManagerIds = [];
            }

            $streamUsers = [];

            try {
                if (! empty($userTableIds)) {
                    foreach (User::whereIn('id', $userTableIds)->get() as $user) {
                        $streamUsers[] = $user->getStreamUserData();
                    }
                }
            } catch (\Throwable $e) {
                Log::error('Error fetching manager users for registration', ['error' => $e->getMessage()]);
            }

            try {
                if (! empty($terminalManagerIds)) {
                    foreach (DB::table('managers')->whereIn('id', $terminalManagerIds)->get() as $mgr) {
                        $streamUsers[] = [
                            'id' => 'm_'.$mgr->id,
                            'name' => $mgr->name ?? trim(($mgr->first_name ?? '').' '.($mgr->last_name ?? '')),
                            'role' => 'user',
                            'image' => PublicMediaUrl::forProfilePhoto($mgr->photo_url),
                        ];
                    }
                }
            } catch (\Throwable $e) {
                Log::error('Error fetching terminal managers for registration', ['error' => $e->getMessage()]);
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
