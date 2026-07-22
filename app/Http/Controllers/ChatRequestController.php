<?php

namespace App\Http\Controllers;

use App\Models\ChatRequest;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatRequestController extends Controller
{
    // ======= PENDING ========
    // get all pending chat request for logged in user
    // use on notification icon to show who send a requst
    public function pending(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        // find all chat request for receiver user and status is 'pending'
        // with('sender') grabs the sender info
        $pendingRequests = $user
            ->receivedChatRequests()
            ->where('status', 'pending')
            ->with('sender')
            ->get();

        return response()->json($pendingRequests);
    }

    // ======= STORE =======
    public function store(Request $request): JsonResponse
    {
        $request->validate(['receiver_id' => ['required', 'exists:users,id'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $receiverId = $request->input('receiver_id');

        // rule 1: you cant send a chat request to yourself
        if ($user->id == $receiverId) {
            return response()->json(['message' => 'You cannot send a chat request to yourself.'], 422);
            // 422 = means "i understand your req but it doesnt make sense"
        }

        // rule 2: check if a conversation alrdy exists between these 2 users
        // if they alrdy have a chat, theres no need for a request
        $existingConversation = $user->conversations()
            ->whereHas('users', function (Builder $q) use ($receiverId) {
                $q->where('users.id', $receiverId);
            })
            ->first();

        if ($existingConversation) {
            return response()->json(
                ['message' => 'You already have a conversation with this user'], 422);
        }

        // rule 3: check if theres already a pending request between thiese 2 users
        $existingRequest = ChatRequest::query()->where(function (Builder $q) use ($user, $receiverId) {
            // look a chat reqeust where im the sender
            $q->where('sender_id', $user->id)
                ->where('receiver_id', $receiverId);
        })
            ->orWhere(function (Builder $q) use ($user, $receiverId) {
                // look a chat request where they are the sender and me a receiver
                $q->where('sender_id', $receiverId)
                    ->where('receiver_id', $user->id);
            })
        // only get if status is pending only
            ->where('status', 'pending')
            ->first(); // get the first row you fint match these rules

        if ($existingRequest) {
            return response()->json(
                ['message' => 'A chat request already exists between you and this user.'],
                422);
        }

        // if rules all passed, create chat req
        $chatRequest = ChatRequest::create([
            'sender_id' => $user->id,
            'receiver_id' => $receiverId,
            'status' => 'pending',
        ]);

        return response()->json($chatRequest, 201); // 201 means succesfully created
    }

    // ======= accept ==========
    public function accept(ChatRequest $chatRequest): JsonResponse
    {
        /**
         * 1. only the person who RECEIVED the request can be able to accept
         * !! implement a policy or middleware later, for now we use route
         */

        // update from pending to accepted
        $chatRequest->update(['status' => 'accepted']);

        // create conversation between sender and receiver
        $conversation = Conversation::create();
        $conversation->users()->attach([$chatRequest->sender_id, $chatRequest->receiver_id]);

        return response()->json($conversation);
    }

    /**
     * ======= reject =========
     * reject a chat request - no convo is created
     */
    public function reject(ChatRequest $chatRequest): JsonResponse
    {
        // update status to rejected
        $chatRequest->update(['status' => 'rejected']);

        return response()->json(['message' => 'Chat Request rejected']);
    }
}
