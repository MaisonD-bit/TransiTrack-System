<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use GetStream\StreamChat\Client as StreamChat;
use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\Handler\CurlHandler;
use GuzzleHttp\HandlerStack;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use App\Support\ManagerTerminalScope;
use App\Support\PublicMediaUrl;

class ChatController extends Controller
{
    use ManagerTerminalScope;
    protected $streamClient;

    public function __construct()
    {
        $apiKey = (string) env('STREAM_API_KEY', '');
        $apiSecret = (string) env('STREAM_API_SECRET', '');

        $this->streamClient = null;

        if ($apiKey === '' || $apiSecret === '') {
            return;
        }

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
                    Log::warning('Could not configure custom Guzzle client for Stream', ['error' => $e->getMessage()]);
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

    /**
     * Match BusOperator: relax TLS verification for Stream's HTTP client in local debug (corporate proxies / dev CA issues).
     */
    private function configureStreamClientSSL(StreamChat $streamClient, GuzzleClient $guzzleClient): void
    {
        try {
            $reflection = new \ReflectionObject($streamClient);
            foreach ($reflection->getProperties() as $property) {
                $property->setAccessible(true);
                $value = $property->getValue($streamClient);

                if ($value instanceof \GuzzleHttp\ClientInterface
                    || (is_object($value) && str_contains(get_class($value), 'Client'))) {
                    $property->setValue($streamClient, $guzzleClient);
                    Log::debug('Configured custom Guzzle client in StreamChat (TerminalManager)');

                    return;
                }
            }
        } catch (\Throwable $e) {
            Log::debug('Could not configure SSL via reflection for Stream', ['error' => $e->getMessage()]);
        }
    }

    /**
     * @param  iterable<string|int>  $memberIds
     * @return array{0: array<int>, 1: array<int>} [users.id, managers.id]
     */
    private function parseStreamMemberIds(iterable $memberIds): array
    {
        $userIds = [];
        $managerRowIds = [];
        foreach ($memberIds as $raw) {
            $s = (string) $raw;
            if (preg_match('/^u_(\d+)$/', $s, $m)) {
                $userIds[] = (int) $m[1];
            } elseif (preg_match('/^m_(\d+)$/', $s, $m)) {
                $managerRowIds[] = (int) $m[1];
            } elseif (ctype_digit($s)) {
                // Legacy numeric ids from older UI builds
                $userIds[] = (int) $s;
            }
        }

        return [array_values(array_unique($userIds)), array_values(array_unique($managerRowIds))];
    }

    /**
     * Bus operators this terminal manager may contact: active (approved) and assigned to the same terminal.
     * Matches {@see ApprovalController::index()} filtering.
     */
    private function approvedBusOperatorsQuery(User $manager)
    {
        $q = DB::table('users')
            ->where('role', 'bus_operator')
            ->where('status', 'active');

        return $this->scopeOperatorsByTerminal($q);
    }

    public function index()
    {
        /** @var User */
        $user = Auth::user();
        $streamUserId = $user->streamUserId();

        $streamApiKey = (string) env('STREAM_API_KEY', '');
        $streamToken = '';
        $streamUnavailable = false;

        if (!$this->streamClient || $streamApiKey === '') {
            $streamUnavailable = true;
        } else {
            try {
                $this->streamClient->upsertUser($user->getStreamUserData());
                $streamToken = $this->streamClient->createToken($streamUserId);
                Log::info('Stream Chat initialized for terminal manager', ['user_id' => $user->id, 'stream_user_id' => $streamUserId]);
            } catch (\Throwable $e) {
                Log::warning('Stream upsert/token error in ChatController@index', [
                    'user_id' => $user->id,
                    'stream_user_id' => $streamUserId,
                    'error' => $e->getMessage(),
                ]);

                try {
                    $streamToken = $this->streamClient->createToken($streamUserId);
                } catch (\Throwable $tokenError) {
                    Log::error('Failed to generate Stream token after upsert failure', [
                        'error' => $tokenError->getMessage(),
                    ]);
                    $streamUnavailable = true;
                }
            }
        }

        return view('operations.chat', [
            'streamApiKey' => $streamApiKey,
            'streamToken' => $streamToken,
            'userId' => $streamUserId,
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
            $currentUser = Auth::user();
            $currentUserId = $currentUser->streamUserId();
            $memberIds = collect($request->members)
                ->map(fn ($memberId) => (string) $memberId)
                ->push($currentUserId)
                ->unique()
                ->values();

            [$userTableIds, $managerRowIds] = $this->parseStreamMemberIds($memberIds);

            $managerUsers = ! empty($managerRowIds)
                ? User::whereIn('id', $managerRowIds)->get()
                : collect();

            $operatorUsers = ! empty($userTableIds)
                ? $this->approvedBusOperatorsQuery($currentUser)
                    ->whereIn('id', $userTableIds)
                    ->get()
                : collect();

            $streamUsers = [];

            foreach ($managerUsers as $user) {
                $streamUsers[] = $user->getStreamUserData();
            }

            foreach ($operatorUsers as $user) {
                $streamUsers[] = [
                    'id' => 'u_'.$user->id,
                    'name' => $user->name,
                    'role' => 'user',
                    'image' => PublicMediaUrl::forProfilePhoto($user->photo_url),
                ];
            }

            if (!empty($streamUsers)) {
                $this->streamClient->upsertUsers($streamUsers);
            }

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

            return response()->json([
                'success' => true,
                'channel' => [
                    'id' => $channel->id,
                    'type' => $request->type,
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getUsers()
    {
        try {
            $currentUser = Auth::user();

            // Terminal managers are rows in `managers` (Eloquent User model).
            $managerQuery = User::where('role', 'terminalManager')
                ->where('status', 'active')
                ->where('id', '!=', $currentUser->id);

            // Prefer same-terminal managers, but fall back to all managers when none are available.
            if ($currentUser && $currentUser->terminal) {
                $sameTerminalManagers = (clone $managerQuery)->where('terminal', $currentUser->terminal);
                $managerQuery = $sameTerminalManagers->exists() ? $sameTerminalManagers : $managerQuery;
            }

            // Do not select `user_id`: it may be absent after migrations (drops legacy link to `users`).
            $managerSelect = ['id', 'first_name', 'last_name', 'photo_url', 'role', 'terminal'];
            if (Schema::hasColumn('managers', 'user_id')) {
                array_unshift($managerSelect, 'user_id');
            }

            $managers = $managerQuery
                ->select($managerSelect)
                ->get()
                ->map(function ($user) {
                    return [
                        'id' => $user->streamUserId(),
                        'name' => $user->name,
                        'photo_url' => PublicMediaUrl::forProfilePhoto($user->photo_url),
                        'role' => $user->role,
                        'formatted_role' => $user->formatted_role,
                        'terminal' => $user->terminal,
                        'source' => 'manager',
                    ];
                });

            $operatorSelect = ['id', 'name', 'photo_url', 'role', 'company_name', 'terminal', 'status'];
            if (Schema::hasColumn('users', 'first_name')) {
                $operatorSelect[] = 'first_name';
                $operatorSelect[] = 'last_name';
            }

            $busOperators = $this->approvedBusOperatorsQuery($currentUser)
                ->select($operatorSelect)
                ->orderBy('name')
                ->get()
                ->map(function ($user) {
                    return [
                        'id' => 'u_'.$user->id,
                        'name' => $user->name,
                        'photo_url' => PublicMediaUrl::forProfilePhoto($user->photo_url),
                        'role' => $user->role,
                        'formatted_role' => 'Bus Operator',
                        'terminal' => $user->terminal ?? null,
                        'company_name' => $user->company_name ?? null,
                        'source' => 'bus_operator',
                    ];
                });

            $users = collect($managers->all())
                ->concat($busOperators->all())
                ->values();

            return response()->json($users);
        } catch (\Throwable $e) {
            Log::error('ChatController@getUsers failed', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'error' => 'Failed to load chat contacts.',
                'detail' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
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
            $currentUser = Auth::user();
            $memberIds = collect($request->user_ids)->map(fn ($id) => (string) $id)->values();
            [$userTableIds, $managerRowIds] = $this->parseStreamMemberIds($memberIds);

            $managerUsers = ! empty($managerRowIds)
                ? User::whereIn('id', $managerRowIds)->get()
                : collect();

            $operatorUsers = ! empty($userTableIds)
                ? $this->approvedBusOperatorsQuery($currentUser)
                    ->whereIn('id', $userTableIds)
                    ->get()
                : collect();

            $streamUsers = [];

            foreach ($managerUsers as $user) {
                $streamUsers[] = $user->getStreamUserData();
            }

            foreach ($operatorUsers as $user) {
                $streamUsers[] = [
                    'id' => 'u_'.$user->id,
                    'name' => $user->name,
                    'role' => 'user',
                    'image' => PublicMediaUrl::forProfilePhoto($user->photo_url),
                ];
            }

            // Upsert users in Stream (server-side)
            if (! empty($streamUsers)) {
                $this->streamClient->upsertUsers($streamUsers);
            }

            return response()->json([
                'success' => true,
                'message' => 'Users registered successfully!'
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

}