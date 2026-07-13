<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ConversationController extends Controller
{
    // ========== index ===========
    // Fetch and return the authenticated user's conversations
    public function index(Request $request): Response{

        /** @var \App\Models\User $user */
        // figure out who is currently logged in user then store it
        $user = $request->user();

        // ======= QUERYING, OPTIMIZING & FORMATTING ==========
        /**
         * $user->conversations() - ask the db what chat rooms the user belong, this came from the user model, public funtion conversations()
         * ->with(['users','messages'] - it finds the link id the connection on user table and message table
         * function($query) {$query->latest()->limit(1);} - this gonly grab only one recent message for each convo
         * 
        */
        $conversations = $user->conversations()->with(['users','messages' => function($query){
            $query->latest()->limit(1);
        }])
        ->get() // execute the sql

        // loop through the data we have (name, time avatar, etc)
        // we use map() to transform raw data into exact format react wants
        ->map(function (Conversation $conversation) use ($user){
            $otherUser = $conversation->users->firstWhere('id','!=', $user->id);

            // get the latest message
            $lastMessage = $conversation->messages->first();

            return [
                'id' => $conversation->id,
                'name' => $otherUser ? $otherUser->name : 'Saved Messages',
                'lastMessage' => $lastMessage ? $lastMessage->body : '',
                'time' => $lastMessage ? $lastMessage->created_at->diffForHumans(short: true): '',
                'avatar' => $otherUser ? strtoupper(substr($otherUser->name, 0, 2)) : 'SM',
                'unread' => 0, // placeholder for now
                'online' => false, // placeholder for now
            ];
        });

        return Inertia::render('Home', ['conversations' => $conversations,]);
    }
}
