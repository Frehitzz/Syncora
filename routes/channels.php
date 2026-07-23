<?php

use App\Models\Conversation;
use Illuminate\Support\Facades\Broadcast;

// only let user listen to this private websocket channel
// if their acutal logged-in user id matches the id in the channel name
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;

});

/**
 * AUTHORIZE THE CONVERSATION PRIVATE CHANNEL
 * - only allow a user to listen if they are a participant
 * of this conversation
 */
Broadcast::channel('conversation.{conversationId}', function ($user,
    $conversationId) {

    // find the conversation in db
    /** @var Conversation|null $conversation */
    $conversation = Conversation::query()->find($conversationId);

    // if conversation doesnt exist, deny access
    if (! $conversation) {
        return false;
    }

    // check if logged in user is in the conversation
    // if yes, return tru (access granted), if no, false (denied)
    return $conversation->users()->where('user_id', $user->id)->exists();
});

/**
 * === AUTHORIZE THE PRESENCE CHANNEL FOR ONLINE STATUS
 * - every authernticated user can join this channel
 * - returned array is the id card that other users see
 */
Broadcast::channel('chat', function ($user) {
    // return the user's data
    return [
        'id' => $user->id,
        'name' => $user->name,
    ];
});

/**
 * === AUTHORIZE THE USER PRIVATE CHANNEL FOR SIDEBAR UPDATES
 * - each user listens on their own channel (user.5, user.12, etc.)
 * - when someone sends them a message, a notification arrives here
 *   so the sidebar can update in real-time without subscribing to every conversation
 */
Broadcast::channel('user.{id}', function ($user, $id) {
    // checks if the logged in users id matches the id of the channel thay are trying to joing
    return (int) $user->id === (int) $id;
});
