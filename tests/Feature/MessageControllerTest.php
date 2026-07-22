<?php

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(RefreshDatabase::class);

test('logged in user can view messages for their conversation', function () {
    // 1. ARRANGE: create 2 users, a conversation and a message
    /** @var User $user */
    $user = User::factory()->create();

    /** @var User $otherUser */
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
    /** @var TestCase $this */
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

test('user cannot view mesages for a conversation they do not belong to', function () {

    // 1. ARRANGE: create a conversation that the user is not part of
    /** @var User $user */
    $user = User::factory()->create();

    /** @var User $stranger1 */
    $stranger1 = User::factory()->create();

    /** @var User $stranger2 */
    $stranger2 = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$stranger1->id, $stranger2->id]);

    /** @var TestCase $this */
    $response = $this->actingAs($user)->getJson(
        route('conversations.messages', $conversation)
    );

    $response->assertForbidden();
});

test('logged in user can send a message to their conversation', function () {
    // 1. ARRANGE: create 2 users and a conversation
    /** @var User $user */
    $user = User::factory()->create();

    /** @var User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 2. ACT: send a POST request with a message body
    /** @var TestCase $this */
    $response = $this->actingAs($user)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => 'Hello from the test!']
    );

    // 3. ASSERT: the response is 201 Created and the message is in the database
    $response->assertCreated();
    $response->assertJsonFragment([
        'content' => 'Hello from the test!',
        'isOwn' => true,
    ]);

    $this->assertDatabaseHas('messages', [
        'conversation_id' => $conversation->id,
        'sender_id' => $user->id,
        'receiver_id' => $otherUser->id,
        'body' => 'Hello from the test!',
    ]);
});

test('user cannot send a message to a conversation they do not belong to', function () {
    // 1. ARRANGE: create a conversation that the user is NOT part of
    /** @var User $user */
    $user = User::factory()->create();

    /** @var User $stranger1 */
    $stranger1 = User::factory()->create();

    /** @var User $stranger2 */
    $stranger2 = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$stranger1->id, $stranger2->id]);

    // 2. ACT: try to send a message as the outsider
    /** @var TestCase $this */
    $response = $this->actingAs($user)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => 'I should not be able to send this!']
    );

    // 3. ASSERT: we get a 403 Forbidden response
    $response->assertForbidden();

    // also verify the message was NOT saved to the database
    $this->assertDatabaseMissing('messages', [
        'body' => 'I should not be able to send this!',
    ]);
});

test('user cannot send an empty message', function () {
    // 1. ARRANGE
    /** @var User $user */
    $user = User::factory()->create();

    /** @var User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 2. ACT: send a POST request with an empty body
    /** @var TestCase $this */
    $response = $this->actingAs($user)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => '']
    );

    // 3. ASSERT: we get a 422 validation error
    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('body');
});
