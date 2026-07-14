<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    // ====== show ========
    // fetch and return all messages for specific conversation
    // we use JsonResponse bc we only fetch the data, here we use AJAX req and it needs raw data (JSON)
    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        // check if the one requesting is a logged in user
        $user = $request->user();

        // before i give you any messages let me verify that you acutally belong to this convo
        // prevent other people going to this message url
        if(!$conversation->users()->where('user_id', $user->id)->exists()){
            abort(403, 'You do not belong to this conversation.');
        }

        // find all the messages where the conversation_id matches this current conversation
        $messages = $conversation->messages()
        // eagerloading, while you are fetching the messages, go to the users table and grab the id and name of the person who sent each message
        ->with('sender:id,name')
        // srt the messages by their created_at date from oldest to newest
        ->oldest()
        // runs the query on the db
        ->get()
        // after we get raw data, this will reformat it so that the home.tsx is expecting this format
        ->map(function ($message) use ($user){
            return [
                'id' => $message->id,
                'sender' => $message->sender->name,
                'content' => $message->body,
                'time' => $message->created_at->format('g:i A'),
                'isOwn' => $message->sender_id === $user->id,
            ];
        });

        return response()->json($messages);
    }
}
