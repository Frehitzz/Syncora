<?php

use App\Models\Conversation;
use App\Models\User;

test('a conversation can link multiple users together',
    function () {
        // 1. CREATE 2 USERS
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        // 2. CREATE CONVERSATION
        $conversation = Conversation::create();

        // 3. LINK USER AND CONVERSATIONS
        // attach() - is laravel methos to insert row into a pivot table
        $conversation->users()->attach([$userA->id, $userB->id]);

        // 4. ASSERT THAT THE CONVERSATION HAS EXACTLY 2 USERS
        expect($conversation->users)->toHaveCount(2);

        // 5. BOTH USERS CAN ACCESS THE CONVERSATION
        // check user A
        // finds all the conversation of user a  belongs to and ask if its have 1
        expect($userA->conversations)->toHaveCount(1);
        // grab that 1 conversation and loo at its id make sure it matches the exact id,
        // of the conversation we created in step 2
        expect($userA->conversations->first()->id)->toBe($conversation->id);

        // check user B
        expect($userB->conversations)->toHaveCount(1);
        expect($userB->conversations->first()->id)->toBe($conversation->id);
    });
