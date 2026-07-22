<?php

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(RefreshDatabase::class);

test('logged in user can view their conversations in the sidebar', function () {

    // 1. ARRANGE: create two users and link them in a conversation
    /** @var User $user */
    $user = User::factory()->create();

    /** @var User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 2: ACT: request the dashboard route
    /** @var TestCase $this */
    $response = $this->actingAs($user)->get(route('dashboard'));

    // 3: ASSERT: assert page loads and contains the conversation data in the props
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('Home')
        ->has('conversations', 1)
        ->where('conversations.0.name', $otherUser->name)
    );
});

test('all conversations are sent to the frontend for client-side search', function () {
    // 1. ARRANGE: create user with multiple conversations
    /** @var User $user */
    $user = User::factory()->create();

    /** @var User $alice */
    $alice = User::factory()->create(['name' => 'alice']);

    /** @var User $bob */
    $bob = User::factory()->create(['name' => 'bob']);

    /** @var User $aia */
    $aia = User::factory()->create(['name' => 'aia']);

    // CREATE 3 CONVERSATIONS WITH DIFFERENT USERS
    $convo1 = Conversation::create();
    $convo1->users()->attach([$user->id, $alice->id]);

    $convo2 = Conversation::create();
    $convo2->users()->attach([$user->id, $bob->id]);

    $convo3 = Conversation::create();
    $convo3->users()->attach([$user->id, $aia->id]);

    // 2. ACT: request the dashboard
    /** @var TestCase $this */
    $response = $this->actingAs($user)->get(route('dashboard'));

    // 3. ASSERT: all 3 conversations are sent to the frontend
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('Home')
        ->has('conversations', 3)
    );

});

test('user can create a new conversation with another user', function () {
    /** @var User $user */
    $user = User::factory()->create();

    /** @var User $otherUser */
    $otherUser = User::factory()->create();

    /** @var TestCase $this */
    $response = $this->actingAs($user)->postJson(route('conversations.store'), [
        'user_id' => $otherUser->id,
    ]);

    $response->assertOk();

    // verify the conversation was created and both users are attaced
    $this->assertDatabaseCount('conversations', 1); // checl if the conversation is succesfullt saved on db
    $this->assertDatabaseCount('conversation_user', 2); // check if theres 2 new rows on the pivot table coversations_user
});

test('creating a conversation with an existing partner returns the existing conversation', function () {
    /** @var User $user */
    $user = User::factory()->create();

    /** @var User $otherUser */
    $otherUser = User::factory()->create();

    // Create an existing conversation
    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // Try to create another one
    /** @var TestCase $this */
    $response = $this->actingAs($user)->postJson(route('conversations.store'), [
        'user_id' => $otherUser->id,
    ]);

    $response->assertOk();

    // Verify NO new conversation was created (count should still be 1)
    $this->assertDatabaseCount('conversations', 1);
});
