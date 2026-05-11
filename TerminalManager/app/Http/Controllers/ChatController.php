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
    protected ?StreamChat $streamClient = null;

    public function __construct()
    {
        $apiKey = (string) config('services.stream_chat.api_key', '');
        $apiSecret = (string) config('services.stream_chat.api_secret', '');

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
                    Log::warning('Stream Chat custom HTTP client not applied', ['error' => $e->getMessage()]);
                    $this->streamClient = new StreamChat($apiKey, $apiSecret);
                }
            } else {
                $this->streamClient = new StreamChat($apiKey, $apiSecret);
            }
        } catch (\Throwable $e) {
            Log::error('Failed to initialize Stream Chat client (Terminal Manager)', [
                'error' => $e->getMessage(),
            ]);
            $this->streamClient = null;
        }
    }

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

                    return;
                }
            }
        } catch (\Throwable $e) {
            Log::debug('Stream SSL reflection skipped', ['error' => $e->getMessage()]);
        }
    }

    /**
     * @param  object{photo_url?: ?string, name?: string, id: int|string}  $row
     * @return array{id: string, name: string, role: string, image: ?string}
     */
    private function streamOperatorPayload(object $row): array
    {
        $image = null;
        if (! empty($row->photo_url)) {
            $p = trim((string) $row->photo_url);
            if ($p !== '') {
                if (str_starts_with($p, 'http://') || str_starts_with($p, 'https://')) {
                    $image = $p;
                } else {
                    $image = rtrim((string) config('app.url'), '/').'/storage/'.ltrim($p, '/');
                }
            }
        }

        return [
            'id' => 'bo_' . (string) $row->id,
            'name' => (string) ($row->name ?? 'Operator'),
            'role' => 'user',
            'image' => $image,
        ];
    }

    /**
     * @return array{stream_members: array<int, string>, manager_ids: array<int, int>, operator_ids: array<int, int>}
     */
    private function parseMemberIds(array $rawIds, User $currentUser): array
    {
        $streamMembers = collect($rawIds)
            ->map(fn ($id) => (string) $id)
            ->filter(fn ($id) => $id !== '')
            ->values();

        $managerIds = [];
        $operatorIds = [];

        foreach ($streamMembers as $id) {
            if (str_starts_with($id, 'tm_')) {
                $managerIds[] = (int) substr($id, 3);
            } elseif (str_starts_with($id, 'bo_')) {
                $operatorIds[] = (int) substr($id, 3);
            }
        }

        // Always include the current user (manager) as tm_{id} in Stream.
        $streamMembers = $streamMembers->push($currentUser->streamUserId())->unique()->values();

        return [
            'stream_members' => $streamMembers->all(),
            'manager_ids' => array_values(array_unique($managerIds)),
            'operator_ids' => array_values(array_unique($operatorIds)),
        ];
    }

    public function index()
    {
        /** @var User $user */
        $user = Auth::user();

        $streamApiKey = (string) config('services.stream_chat.api_key', '');
        $streamToken = '';
        $streamUnavailable = false;

        if (! $this->streamClient || $streamApiKey === '') {
            $streamUnavailable = true;
        } else {
            try {
                $this->streamClient->upsertUser($user->getStreamUserData());
                $streamToken = $user->getStreamToken();
            } catch (\Throwable $e) {
                Log::warning('Stream chat upsert failed in Terminal Manager ChatController@index', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);

                try {
                    $streamToken = $user->getStreamToken();
                } catch (\Throwable $tokenError) {
                    Log::error('Stream token generation failed (Terminal Manager)', [
                        'user_id' => $user->id,
                        'error' => $tokenError->getMessage(),
                    ]);
                    $streamUnavailable = true;
                }
            }
        }

        return view('operations.chat', [
            'streamApiKey' => $streamApiKey,
            'streamToken' => $streamToken,
            'userId' => $user->streamUserId(),
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

        if (! $this->streamClient) {
            return response()->json([
                'success' => false,
                'error' => 'Chat service is currently unavailable.',
            ], 503);
        }

        try {
            /** @var User $currentUser */
            $currentUser = Auth::user();

            $parsed = $this->parseMemberIds((array) $request->members, $currentUser);
            $memberIds = $parsed['stream_members'];

            $managerUsers = User::whereIn('id', $parsed['manager_ids'])->get();
            $operatorUsers = DB::table('users')
                ->whereIn('id', $parsed['operator_ids'])
                ->where('role', 'bus_operator')
                ->get();

            $streamUsers = [];

            foreach ($managerUsers as $u) {
                $streamUsers[] = $u->getStreamUserData();
            }

            foreach ($operatorUsers as $u) {
                $streamUsers[] = $this->streamOperatorPayload($u);
            }

            if (! empty($streamUsers)) {
                try {
                    $this->streamClient->upsertUsers($streamUsers);
                } catch (\Throwable $e) {
                    Log::warning('Stream upsertUsers (createChannel) partial failure', ['error' => $e->getMessage()]);
                }
            }

            $channel = $this->streamClient->channel(
                $request->type,
                $request->id,
                [
                    'name' => $request->name,
                    'created_by' => ['id' => $currentUser->streamUserId()],
                    'members' => $memberIds,
                ]
            );

            $channel->create($currentUser->streamUserId());

            return response()->json([
                'success' => true,
                'channel' => [
                    'id' => $channel->id,
                    'type' => $request->type,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Terminal Manager createChannel', ['error' => $e->getMessage()]);

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getUsers()
    {
        $currentUser = Auth::user();

        $managerQuery = User::where('id', '!=', Auth::id());

        if ($currentUser && $currentUser->terminal) {
            $sameTerminalManagers = (clone $managerQuery)->where('terminal', $currentUser->terminal);
            $managerQuery = $sameTerminalManagers->exists() ? $sameTerminalManagers : $managerQuery;
        }

        $managers = $managerQuery
            ->select(['id', 'first_name', 'last_name', 'photo_url', 'role', 'terminal'])
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->streamUserId(),
                    'app_id' => $user->id,
                    'name' => $user->name,
                    'photo_url' => $user->photo_url,
                    'role' => $user->role,
                    'formatted_role' => $user->formatted_role,
                    'terminal' => $user->terminal,
                    'source' => 'manager',
                ];
            });

        $operatorsQuery = DB::table('users')
            ->where('role', 'bus_operator')
            ->where('status', 'active');

        if ($currentUser && $currentUser->terminal) {
            $operatorsQuery->where('terminal', $currentUser->terminal);
        }

        $busOperators = $operatorsQuery
            ->select(['id', 'name', 'first_name', 'last_name', 'photo_url', 'role', 'company_name', 'terminal'])
            ->get()
            ->map(function ($user) {
                return [
                    'id' => 'bo_' . (string) $user->id,
                    'app_id' => $user->id,
                    'name' => $user->name,
                    'photo_url' => $user->photo_url,
                    'role' => $user->role,
                    'formatted_role' => 'Bus Operator',
                    'terminal' => $user->terminal ?? null,
                    'company_name' => $user->company_name ?? null,
                    'source' => 'bus_operator',
                ];
            });

        $users = $managers->merge($busOperators)->values();

        return response()->json($users);
    }

    public function registerUsers(Request $request)
    {
        $request->validate([
            'user_ids' => 'required|array',
        ]);

        if (! $this->streamClient) {
            return response()->json([
                'success' => false,
                'error' => 'Chat service is currently unavailable.',
            ], 503);
        }

        try {
            /** @var User $currentUser */
            $currentUser = Auth::user();
            $parsed = $this->parseMemberIds((array) $request->user_ids, $currentUser);

            $managerUsers = User::whereIn('id', $parsed['manager_ids'])->get();
            $operatorUsers = DB::table('users')
                ->whereIn('id', $parsed['operator_ids'])
                ->where('role', 'bus_operator')
                ->get();

            $streamUsers = [];

            foreach ($managerUsers as $u) {
                $streamUsers[] = $u->getStreamUserData();
            }

            foreach ($operatorUsers as $u) {
                $streamUsers[] = $this->streamOperatorPayload($u);
            }

            if (! empty($streamUsers)) {
                $this->streamClient->upsertUsers($streamUsers);
            }

            return response()->json([
                'success' => true,
                'message' => 'Users registered successfully!',
            ]);
        } catch (\Throwable $e) {
            Log::error('Terminal Manager registerUsers', ['error' => $e->getMessage()]);

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
