<?php

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

uses(RefreshDatabase::class);

test('MessageSent event broadcasts on both conversation and user channels', function () {
    // 1. ARRANGE: create a conversation with two users and a message
    /** @var User $sender */
    $sender = User::factory()->create();

    /** @var User $receiver */
    $receiver = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$sender->id, $receiver->id]);

    $message = Message::create([
        'conversation_id' => $conversation->id,
        'sender_id' => $sender->id,
        'receiver_id' => $receiver->id,
        'body' => 'Hello from the test!',
        'is_read' => false,
    ]);

    // load the sender relationship so broadcastWith() can access sender->name
    $message->load('sender');

    // 2. ACT: create the event and check what channels it broadcasts on
    $event = new MessageSent($message);
    $channels = $event->broadcastOn();

    // 3. ASSERT: the event should broadcast on both channels
    // channel 1: conversation.{id} — for the active chat window
    // channel 2: user.{receiver_id} — for the sidebar real-time updates
    expect($channels)->toHaveCount(2);

    $channelNames = array_map(fn ($ch) => $ch->name, $channels);

    expect($channelNames)->toContain('private-conversation.'.$conversation->id);
    expect($channelNames)->toContain('private-user.'.$receiver->id);
});

test('MessageSent broadcastWith includes conversation_id', function () {
    // 1. ARRANGE
    /** @var User $sender */
    $sender = User::factory()->create();

    /** @var User $receiver */
    $receiver = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$sender->id, $receiver->id]);

    $message = Message::create([
        'conversation_id' => $conversation->id,
        'sender_id' => $sender->id,
        'receiver_id' => $receiver->id,
        'body' => 'Testing payload!',
        'is_read' => false,
    ]);

    $message->load('sender');

    // 2. ACT
    $event = new MessageSent($message);
    $payload = $event->broadcastWith();

    // 3. ASSERT: the payload should include conversation_id for the frontend sidebar
    expect($payload)->toHaveKey('conversation_id', $conversation->id);
    expect($payload)->toHaveKey('content', 'Testing payload!');
    expect($payload)->toHaveKey('sender', $sender->name);
});

test('sending a message dispatches MessageSent event on user channel', function () {
    // 1. ARRANGE: fake all events so they don't actually broadcast
    Event::fake([MessageSent::class]);

    /** @var User $sender */
    $sender = User::factory()->create();

    /** @var User $receiver */
    $receiver = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$sender->id, $receiver->id]);

    // 2. ACT: the sender sends a message via the API
    /** @var TestCase $this */
    $response = $this->actingAs($sender)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => 'Real-time sidebar test!']
    );

    $response->assertCreated();

    // 3. ASSERT: the MessageSent event was dispatched
    Event::assertDispatched(MessageSent::class, function (MessageSent $event) use ($conversation, $receiver) {
        $channels = $event->broadcastOn();
        $channelNames = array_map(fn ($ch) => $ch->name, $channels);

        // verify it broadcasts to both channels
        return in_array('private-conversation.'.$conversation->id, $channelNames)
            && in_array('private-user.'.$receiver->id, $channelNames);
    });
});
