<?php

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

// ======= VERIFY THE EVENT FIRES WHEN A MESSAGE IS SENT ==========
test('MessageSent event is dispatched when a user sends a message', function () {
    // 1. TELL LARAVEL TO FAKE ALL EVENTS (don't actually broadcast, just record)
    //    This is like telling the post office: "Don't actually deliver any letters.
    //    Just write down that someone tried to send them."
    Event::fake();

    // 2. ARRANGE: set up two users and a conversation
    /** @var \App\Models\User $user */
    $user = User::factory()->create();

    /** @var \App\Models\User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 3. ACT: send a message via the API (same as a real user clicking Send)
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => 'Hello in real-time!']
    );

    // 4. ASSERT: the response is successful
    $response->assertCreated();

    // 5. ASSERT: the MessageSent event was dispatched exactly once
    //    Event::assertDispatched() checks the "post office records"
    //    and verifies that MessageSent was attempted to be sent
    Event::assertDispatched(MessageSent::class, function (MessageSent $event) {
        // Also verify that the event contains the correct message text
        return $event->message->body === 'Hello in real-time!';
    });
});

// ======= VERIFY THE EVENT IS NOT FIRED FOR UNAUTHORIZED USERS ==========
test('MessageSent event is NOT dispatched if user does not belong to the conversation', function () {
    // 1. Fake events so we can check if they were (or weren't) fired
    Event::fake();

    // 2. ARRANGE: user is NOT part of this conversation
    /** @var \App\Models\User $outsider */
    $outsider = User::factory()->create();

    /** @var \App\Models\User $member1 */
    $member1 = User::factory()->create();

    /** @var \App\Models\User $member2 */
    $member2 = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$member1->id, $member2->id]);

    // 3. ACT: try to send a message as the outsider
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($outsider)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => 'I am not allowed here!']
    );

    // 4. ASSERT: access is denied
    $response->assertForbidden();

    // 5. ASSERT: the event was NOT fired (because the message was never saved)
    Event::assertNotDispatched(MessageSent::class);
});
