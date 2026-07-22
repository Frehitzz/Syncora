<?php

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ======= VERIFY THAT TYPING EVENTS DO NOT CREATE ANY DATABASE RECORDS ==========
// Typing indicators use whisper events (client-side only).
// This test ensures that the typing feature hasn't been accidentally
// wired to a controller, event, or model that saves to the database.
test('typing events do NOT create any records in the messages table', function () {
    // 1. ARRANGE: create two users and a conversation between them
    /** @var \App\Models\User $alice */
    $alice = User::factory()->create(['name' => 'Alice']);

    /** @var \App\Models\User $bob */
    $bob = User::factory()->create(['name' => 'Bob']);

    $conversation = Conversation::create();
    $conversation->users()->attach([$alice->id, $bob->id]);

    // 2. SNAPSHOT: count how many messages exist BEFORE the "typing" interaction
    //    We take a snapshot so we can compare "before" vs "after"
    $messageCountBefore = Message::count();

    // 3. ACT: simulate what would happen if someone mistakenly created
    //    a "typing" API endpoint — we verify no such route exists
    //    by checking that common typing-related routes return 404/405
    /** @var \Tests\TestCase $this */

    // Try POST /conversations/{id}/typing — should NOT exist
    $response = $this->actingAs($alice)->postJson(
        "/conversations/{$conversation->id}/typing",
        ['typing' => true]
    );

    // The route should not exist (404) or not be a POST route (405)
    // Either way, it should NOT be a successful 200/201/204
    expect($response->status())->toBeGreaterThanOrEqual(404);

    // 4. ASSERT: the message count has NOT changed
    //    If it changed, it means something in the app is saving typing events
    $messageCountAfter = Message::count();
    expect($messageCountAfter)->toBe($messageCountBefore);
});

// ======= VERIFY NO "TYPING" ROUTE EXISTS IN THE APPLICATION ==========
// This is a guard-rail test: if a future developer accidentally adds
// a route to handle typing events server-side, this test will fail
// and remind them that typing should stay client-side only.
test('no server-side typing route exists for conversations', function () {
    /** @var \App\Models\User $user */
    $user = User::factory()->create();

    /** @var \App\Models\Conversation $conversation */
    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id]);

    /** @var \Tests\TestCase $this */

    // Try all common HTTP methods on a hypothetical typing endpoint
    $postResponse = $this->actingAs($user)->postJson("/conversations/{$conversation->id}/typing");
    $getResponse = $this->actingAs($user)->getJson("/conversations/{$conversation->id}/typing");
    $putResponse = $this->actingAs($user)->putJson("/conversations/{$conversation->id}/typing");

    // ALL of these should fail — typing is client-side only
    // 404 = route doesn't exist, 405 = method not allowed
    // Both are acceptable — what's NOT acceptable is 200, 201, or 204
    expect($postResponse->status())->toBeGreaterThanOrEqual(400);
    expect($getResponse->status())->toBeGreaterThanOrEqual(400);
    expect($putResponse->status())->toBeGreaterThanOrEqual(400);
});

// ======= VERIFY THE MESSAGES TABLE IS CLEAN AFTER SIMULATED TYPING ==========
// This is an extra safety check: even if we send multiple requests
// pretending to be "typing" events, the database should remain untouched.
test('database remains clean after simulated typing activity', function () {
    // 1. ARRANGE
    /** @var \App\Models\User $user */
    $user = User::factory()->create();

    /** @var \App\Models\User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 2. ACT: send a real message (this SHOULD create a record)
    /** @var \Tests\TestCase $this */
    $this->actingAs($user)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => 'Hello Bob!']
    );

    // 3. ASSERT: exactly 1 message exists — the real one we just sent
    expect(Message::count())->toBe(1);
    expect(Message::first()->body)->toBe('Hello Bob!');

    // 4. ACT: try the typing route again (should not exist)
    $this->actingAs($user)->postJson("/conversations/{$conversation->id}/typing", [
        'typing' => true,
        'user' => $user->name,
    ]);

    // 5. ASSERT: still exactly 1 message — typing didn't create anything
    expect(Message::count())->toBe(1);
});
