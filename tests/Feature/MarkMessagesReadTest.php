<?php

use App\Jobs\MarkMessageRead;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

uses(RefreshDatabase::class);

test('opening a conversation dispatches the mark messages read job', function () {
    // 1. ARRANGE: fake the queue so jobs don't actually run
    // Queue::fake() intercepts all dispatched jobs and stores them in memory
    // this lets us assert "was this job dispatched?" without running it
    Queue::fake();

    /** @var User $sender */
    $sender = User::factory()->create();

    /** @var User $receiver */
    $receiver = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$sender->id, $receiver->id]);

    // create unread messages from sender to receiver
    Message::create([
        'conversation_id' => $conversation->id,
        'sender_id' => $sender->id,
        'receiver_id' => $receiver->id,
        'body' => 'Hello!',
        'is_read' => false,
    ]);

    // 2. ACT: the receiver hits the mark-read endpoint
    /** @var TestCase $this
     *
     * - $this->actingAs($receiver) - this act like a user is logged in
     * - postJson() - simulaates react frontend, fire a fake http post request (like the user click this button)
     * - route('conversations.mark-read', $conversation) - go to the web.php,
     * find the named conversations.mark-read and use that route
     *
     * ENGLISH:
     * "Log in as the Receiver, simulate the React frontend sending a POST request to
     * the 'mark-read' URL for this specific chat, and save whatever the server
     * replies with into a variable."
     */
    $response = $this->actingAs($receiver)->postJson(
        route('conversations.mark-read', $conversation)
    );

    // 3. ASSERT: the endpoint returns success and the job was dispatched
    $response->assertOk();

    // verify the job was pushed to the queue with the correct data
    Queue::assertPushed(MarkMessageRead::class, function ($job) use ($conversation, $receiver) {
        return $job->conversationId === $conversation->id
            && $job->userId === $receiver->id;
    });
});

test('mark messages read job updates unread messages to read', function () {
    // 1. ARRANGE: create a conversation with unread messages
    /** @var User $sender */
    $sender = User::factory()->create();

    /** @var User $receiver */
    $receiver = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$sender->id, $receiver->id]);

    // create 3 unread messages
    foreach (['Hey!', 'Are you there?', 'Hello??'] as $body) {
        Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $sender->id,
            'receiver_id' => $receiver->id,
            'body' => $body,
            'is_read' => false,
        ]);
    }

    // 2. ACT: run the job directly (not through the queue)
    // we instantiate and call handle() to test the job's logic in isolation
    $job = new MarkMessageRead($conversation->id, $receiver->id);
    $job->handle();

    // 3. ASSERT: all 3 messages should now be read
    /** @var TestCase $this */
    $this->assertDatabaseCount('messages', 3);

    // verify every message in this conversation is now marked as read
    $unreadCount = Message::where('conversation_id', $conversation->id)
        ->where('is_read', false)
        ->count();

    expect($unreadCount)->toBe(0);
});

test('mark messages read does not affect messages sent by the reader', function () {
    // 1. ARRANGE: create messages in both directions
    /** @var User $userA */
    $userA = User::factory()->create();

    /** @var User $userB */
    $userB = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$userA->id, $userB->id]);

    // message from A to B (B is the receiver)
    Message::create([
        'conversation_id' => $conversation->id,
        'sender_id' => $userA->id,
        'receiver_id' => $userB->id,
        'body' => 'From A to B',
        'is_read' => false,
    ]);

    // message from B to A (A is the receiver)
    Message::create([
        'conversation_id' => $conversation->id,
        'sender_id' => $userB->id,
        'receiver_id' => $userA->id,
        'body' => 'From B to A',
        'is_read' => false,
    ]);

    // 2. ACT: User B marks messages as read
    // this should only mark messages where B is the RECEIVER
    $job = new MarkMessageRead($conversation->id, $userB->id);
    $job->handle();

    // 3. ASSERT: only the message sent TO User B should be marked as read
    /** @var TestCase $this */
    $this->assertDatabaseHas('messages', [
        'body' => 'From A to B',
        'receiver_id' => $userB->id,
        'is_read' => true,  // ← this one should be read (B is the receiver)
    ]);

    $this->assertDatabaseHas('messages', [
        'body' => 'From B to A',
        'receiver_id' => $userA->id,
        'is_read' => false,  // ← this one should still be unread (A is the receiver, not B)
    ]);
});

test('user cannot mark messages as read in a conversation they do not belong to', function () {
    // 1. ARRANGE: create a conversation the outsider is NOT part of
    /** @var User $outsider */
    $outsider = User::factory()->create();

    /** @var User $userA */
    $userA = User::factory()->create();

    /** @var User $userB */
    $userB = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$userA->id, $userB->id]);

    // 2. ACT: outsider tries to mark messages as read
    /** @var TestCase $this */
    $response = $this->actingAs($outsider)->postJson(
        route('conversations.mark-read', $conversation)
    );

    // 3. ASSERT: should be forbidden
    $response->assertForbidden();
});

test('conversation list shows correct unread count', function () {
    // 1. ARRANGE: create a conversation with 2 unread messages
    /** @var User $sender */
    $sender = User::factory()->create();

    /** @var User $receiver */
    $receiver = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$sender->id, $receiver->id]);

    // create 2 unread messages
    Message::create([
        'conversation_id' => $conversation->id,
        'sender_id' => $sender->id,
        'receiver_id' => $receiver->id,
        'body' => 'First unread',
        'is_read' => false,
    ]);

    Message::create([
        'conversation_id' => $conversation->id,
        'sender_id' => $sender->id,
        'receiver_id' => $receiver->id,
        'body' => 'Second unread',
        'is_read' => false,
    ]);

    // create 1 already-read message
    Message::create([
        'conversation_id' => $conversation->id,
        'sender_id' => $sender->id,
        'receiver_id' => $receiver->id,
        'body' => 'Already read',
        'is_read' => true,
    ]);

    // 2. ACT: load the dashboard as the receiver
    /** @var TestCase $this */
    $response = $this->actingAs($receiver)->get(route('dashboard'));

    // 3. ASSERT: the conversation should show unread count of 2 (not 3)
    $response->assertOk();
    $response->assertInertia(function ($page) {
        $conversations = $page->toArray()['props']['conversations'];
        // the first conversation should have unread = 2
        expect($conversations[0]['unread'])->toBe(2);
    });
});
