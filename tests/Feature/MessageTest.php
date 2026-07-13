<?php

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('can get the sender and receiver of a message',
    function () {
        // 1. ARRANGE: created 2 fake users in our testing db
        $userA = User::factory()->create();
        $userB = User::factory()->create();
        $conversation = Conversation::create();

        // 2. ACT: created message sent from user A to user B
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $userA->id,
            'receiver_id' => $userB->id,
            'body' => 'HELLO THIS IS FROM USER A',
            'is_read' => false,
        ]);

        // 3. ASSERT: check if the relationship actually work

        // does the message's sender match user A?
        expect($message->sender->id)->toBe($userA->id);

        // does the message's receiver match user B?
        expect($message->receiver->id)->toBe($userB->id);

        // does User A sent messages contiane this message?
        expect($userA->sentMessage->contains($message))->toBeTrue();

    });
