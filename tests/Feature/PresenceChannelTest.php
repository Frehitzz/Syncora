<?php

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

uses(RefreshDatabase::class);

// ======= VERIFY AUTHENTICATED USERS CAN JOIN THE PRESENCE CHANNEL ==========
test('authenticated user can join the presence channel and receives correct data', function () {
    // 1. ARRANGE: create a user
    /** @var User $user */
    $user = User::factory()->create(['name' => 'Alice']);

    // We need to set the broadcast driver to something that actually performs auth
    // (the default 'null' driver in testing returns an empty response)
    Config::set('broadcasting.default', 'reverb');
    require base_path('routes/channels.php');

    // 2. ACT: simulate an auth request for the presence channel
    //    Laravel's broadcast auth endpoint is POST /broadcasting/auth
    //    We send the channel name as "presence-chat" because that's what Echo sends
    /** @var TestCase $this */
    $response = $this->actingAs($user)->postJson('/broadcasting/auth', [
        'channel_name' => 'presence-chat',
        'socket_id' => '1234.5678',
    ]);

    // 3. ASSERT: the response is successful (200)
    //    For presence channels, Laravel returns a JSON response with channel_data
    $response->assertOk();

    // 4. ASSERT: the channel_data contains our user's info
    //    Laravel wraps the return value from channels.php in a "channel_data" JSON string
    $channelData = json_decode($response->json('channel_data'), true);
    expect($channelData['user_id'])->toEqual($user->id);
    expect($channelData['user_info']['id'])->toEqual($user->id);
    expect($channelData['user_info']['name'])->toBe('Alice');
});

// ======= VERIFY GUESTS CANNOT JOIN THE PRESENCE CHANNEL ==========
test('unauthenticated user cannot join the presence channel', function () {
    Config::set('broadcasting.default', 'reverb');
    require base_path('routes/channels.php');

    // 1. ACT: try to auth without being logged in
    /** @var TestCase $this */
    $response = $this->postJson('/broadcasting/auth', [
        'channel_name' => 'presence-chat',
        'socket_id' => '1234.5678',
    ]);

    // 2. ASSERT: access denied (403 Forbidden because Broadcaster throws AccessDeniedHttpException)
    $response->assertForbidden();
});

// ======= VERIFY CONVERSATION DATA INCLUDES OTHER USER ID ==========
test('conversation data includes otherUserId for the frontend', function () {
    // 1. ARRANGE: create two users and a conversation between them
    /** @var User $user */
    $user = User::factory()->create();

    /** @var User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 2. ACT: visit the dashboard (which loads conversations via Inertia)
    /** @var TestCase $this */
    $response = $this->actingAs($user)->get(route('dashboard'));

    // 3. ASSERT: the response contains the conversation data with otherUserId
    $response->assertOk();

    // Inertia renders props — we check the page component and its props
    $response->assertInertia(function ($page) use ($otherUser) {
        $page->component('Home')
            ->has('conversations', 1)
            ->where('conversations.0.otherUserId', $otherUser->id);
    });
});
