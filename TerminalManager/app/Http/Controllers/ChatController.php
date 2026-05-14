<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use GetStream\StreamChat\Client as StreamChat;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ChatController extends Controller
{
    protected $streamClient;

    public function __construct()
    {
        $apiKey = (string) env('STREAM_API_KEY', '');
        $apiSecret = (string) env('STREAM_API_SECRET', '');

        $this->streamClient = null;

        if ($apiKey !== '' && $apiSecret !== '') {
            $this->streamClient = new StreamChat($apiKey, $apiSecret);
        }
    }

    public function index()
    {
        /** @var User */
        $user = Auth::user();
        $streamUserId = $this->streamUserIdForManager($user);

        $streamApiKey = (string) env('STREAM_API_KEY', '');
        $streamToken = '';
        $streamUnavailable = false;

        if (!$this->streamClient || $streamApiKey === '') {
            $streamUnavailable = true;
        } else {
            try {
                $this->streamClient->upsertUser($this->streamUserDataForManager($user));
                $streamToken = $this->streamClient->createToken($streamUserId);
            } catch (\Throwable $e) {
                Log::warning('Stream chat unavailable in ChatController@index', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);

                $streamUnavailable = true;
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
            $currentUserId = $this->streamUserIdForManager($currentUser);
            $memberIds = collect($request->members)
                ->map(fn($memberId) => (string) $memberId)
                ->push($currentUserId)
                ->unique()
                ->values();

            $managerUsers = User::whereIn('user_id', $memberIds)
                ->orWhere(function ($query) use ($memberIds) {
                    $query->whereNull('user_id')->whereIn('id', $memberIds);
                })
                ->get();
            $operatorUsers = DB::table('users')
                ->whereIn('id', $memberIds)
                ->where('role', 'bus_operator')
                ->get();

            $streamUsers = [];

            foreach ($managerUsers as $user) {
                $streamUsers[] = $this->streamUserDataForManager($user);
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
        $currentUser = Auth::user();

        $currentStreamUserId = $this->streamUserIdForManager($currentUser);
        $managerQuery = User::where('role', 'terminalManager')
            ->where('status', 'active')
            ->whereExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('users')
                    ->where('users.role', 'terminalManager')
                    ->where('users.status', 'active')
                    ->where(function ($inner) {
                        $inner->whereColumn('users.id', 'managers.user_id')
                            ->orWhereColumn('users.email', 'managers.email');
                    });
            })
            ->where(function ($query) use ($currentStreamUserId) {
                $query->where('user_id', '!=', $currentStreamUserId)
                    ->orWhereNull('user_id');
            })
            ->where('id', '!=', Auth::id());

        // Prefer same-terminal managers, but fall back to all managers when none are available.
        if ($currentUser && $currentUser->terminal) {
            $sameTerminalManagers = (clone $managerQuery)->where('terminal', $currentUser->terminal);
            $managerQuery = $sameTerminalManagers->exists() ? $sameTerminalManagers : $managerQuery;
        }

        $managers = $managerQuery
            ->select(['id', 'user_id', 'first_name', 'last_name', 'photo_url', 'role', 'terminal'])
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $this->streamUserIdForManager($user),
                    'name' => $user->name,
                    'photo_url' => $user->photo_url,
                    'role' => $user->role,
                    'formatted_role' => $user->formatted_role,
                    'terminal' => $user->terminal,
                    'source' => 'manager',
                ];
            });

        $busOperators = DB::table('users')
            ->where('role', 'bus_operator')
            ->where('status', 'active')
            ->select(['id', 'name', 'first_name', 'last_name', 'photo_url', 'role', 'company_name'])
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'photo_url' => $user->photo_url,
                    'role' => $user->role,
                    'formatted_role' => 'Bus Operator',
                    'terminal' => null,
                    'company_name' => $user->company_name ?? null,
                    'source' => 'bus_operator',
                ];
            });

        $users = collect($managers->all())
            ->concat($busOperators->all())
            ->values();

        return response()->json($users);
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
            $memberIds = collect($request->user_ids)->map(fn ($id) => (string) $id)->values();

            $managerUsers = User::whereIn('user_id', $memberIds)
                ->orWhere(function ($query) use ($memberIds) {
                    $query->whereNull('user_id')->whereIn('id', $memberIds);
                })
                ->get();
            $operatorUsers = DB::table('users')
                ->whereIn('id', $memberIds)
                ->where('role', 'bus_operator')
                ->get();

            $streamUsers = [];

            foreach ($managerUsers as $user) {
                $streamUsers[] = $this->streamUserDataForManager($user);
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
            $this->streamClient->upsertUsers($streamUsers);

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

    private function streamUserIdForManager(User $user): string
    {
        return (string) ($user->user_id ?: $user->id);
    }

    private function streamUserDataForManager(User $user): array
    {
        return [
            'id' => $this->streamUserIdForManager($user),
            'name' => $user->name,
            'role' => 'user',
            'image' => $user->photo_url ?? null,
        ];
    }
}
