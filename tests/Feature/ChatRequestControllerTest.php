<?php

use App\Models\User;
use App\Models\ChatRequest;
use App\Models\Conversation;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('user can send a chat request to another user', function () {
    /** @var \App\Models\User $sender */
    $sender = User::factory()->create();

    /** @var \App\Models\User $receiver */
    $receiver = User::factory()->create();

    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($sender)->postJson(route('chat-requests.store'), [
        'receiver_id' => $receiver->id,
    ]);

    $response->assertStatus(201); // 201 means "created"

    // check if the chat request was saved in the database
    $this->assertDatabaseHas('chat_requests', [
        'sender_id' => $sender->id,
        'receiver_id' => $receiver->id,
        'status' => 'pending',
    ]);
});

test('accepting a chat request creates a conversation with both users', function () {
    /** @var \App\Models\User $sender */
    $sender = User::factory()->create();

    /** @var \App\Models\User $receiver */
    $receiver = User::factory()->create();

    // create a pending chat request in the database
    $chatRequest = ChatRequest::create([
        'sender_id' => $sender->id,
        'receiver_id' => $receiver->id,
        'status' => 'pending',
    ]);

    // the RECEIVER accepts the request
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($receiver)->patchJson(
        route('chat-requests.accept', $chatRequest)
    );

    $response->assertOk();

    // check that the request status changed to "accepted"
    $this->assertDatabaseHas('chat_requests', [
        'id' => $chatRequest->id,
        'status' => 'accepted',
    ]);

    // check that a conversation was created
    $this->assertDatabaseCount('conversations', 1);

    // check that both users are attached to the conversation
    $this->assertDatabaseCount('conversation_user', 2);
});

test('rejecting a chat request does not create a conversation', function () {
    /** @var \App\Models\User $sender */
    $sender = User::factory()->create();

    /** @var \App\Models\User $receiver */
    $receiver = User::factory()->create();

    // create a pending chat request
    $chatRequest = ChatRequest::create([
        'sender_id' => $sender->id,
        'receiver_id' => $receiver->id,
        'status' => 'pending',
    ]);

    // the RECEIVER rejects the request
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($receiver)->patchJson(
        route('chat-requests.reject', $chatRequest)
    );

    $response->assertOk();

    // check that the request status changed to "rejected"
    $this->assertDatabaseHas('chat_requests', [
        'id' => $chatRequest->id,
        'status' => 'rejected',
    ]);

    // check that NO conversation was created
    $this->assertDatabaseCount('conversations', 0);
});

test('user cannot send a duplicate chat request', function () {
    /** @var \App\Models\User $sender */
    $sender = User::factory()->create();

    /** @var \App\Models\User $receiver */
    $receiver = User::factory()->create();

    // create the first request (this should work)
    ChatRequest::create([
        'sender_id' => $sender->id,
        'receiver_id' => $receiver->id,
        'status' => 'pending',
    ]);

    // try to send a SECOND request to the same person (this should fail)
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($sender)->postJson(route('chat-requests.store'), [
        'receiver_id' => $receiver->id,
    ]);

    $response->assertStatus(422); // 422 means "invalid request"

    // there should still be only 1 chat request in the database
    $this->assertDatabaseCount('chat_requests', 1);
});

test('user cannot send a chat request to themselves', function () {
    /** @var \App\Models\User $user */
    $user = User::factory()->create();

    // try to send a request to yourself
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->postJson(route('chat-requests.store'), [
        'receiver_id' => $user->id,
    ]);

    $response->assertStatus(422); // should be rejected

    // no chat request should be in the database
    $this->assertDatabaseCount('chat_requests', 0);
});
