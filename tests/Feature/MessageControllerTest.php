<?php

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('logged in user can view messages for their conversation', function (){
    // 1. ARRANGE: create 2 users, a conversation and a message
    /** @var \App\Models\User $user */
    $user = User::factory()->create();
    
    /** @var \App\Models\User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    Message::create([
        'conversation_id' => $conversation->id,
        'sender_id' => $otherUser->id,
        'receiver_id' => $user->id,
        'body' => 'Hey, how are you?',
        'is_read' => false,
    ]);

    // 2. ACT: request the messages for this conversation
   /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->getJson(
        route('conversations.messages', $conversation)
    );

    // 3. ASSERT: the response contains the correct message data
    $response->assertOk();
    $response->assertJsonCount(1);
    $response->assertJsonFragment([
        'sender' => $otherUser->name,
        'content' => 'Hey, how are you?',
        'isOwn' => false,
    ]);
});

test('user cannot view mesages for a conversation they do not belong to', function (){

    // 1. ARRANGE: create a conversation that the user is not part of
    /** @var \App\Models\User $user */
    $user = User::factory()->create();
    
    /** @var \App\Models\User $stranger1 */
    $stranger1 = User::factory()->create();
    
    /** @var \App\Models\User $stranger2 */
    $stranger2 = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$stranger1->id,$stranger2->id]);

    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->getJson(
        route('conversations.messages', $conversation)
    );

    $response->assertForbidden();
});