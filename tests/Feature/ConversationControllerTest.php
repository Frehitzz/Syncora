<?php

use App\Models\User;
use App\Models\Conversation;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('logged in user can view their conversations in the sidebar', function (){
    
    // 1. ARRANGE: create two users and link them in a conversation
    /** @var User $user */
    $user = User::factory()->create();
    
    /** @var User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 2: ACT: request the dashboard route
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->get(route('dashboard'));

    // 3: ASSERT: assert page loads and contains the conversation data in the props
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
    ->component('Home')
    ->has('conversations', 1)
    ->where('conversations.0.name', $otherUser->name)
    );
});

test ('all conversations are sent to the frontend for client-side search', function (){
    // 1. ARRANGE: create user with multiple conversations
    /** @var App\Models\User $user */
    $user = User::factory()->create();

    /** @var App\Models\User $alice */
    $alice = User::factory()->create(['name' => 'alice']);

    /** @var App\Models\User $bob */
    $bob = User::factory()->create(['name' => 'bob']);

    /** @var App\Models\User $aia */
    $aia = User::factory()->create(['name' => 'aia']);

    // CREATE 3 CONVERSATIONS WITH DIFFERENT USERS
    $convo1 = Conversation::create();
    $convo1->users()->attach([$user->id, $alice->id]);

    $convo2 = Conversation::create();
    $convo2->users()->attach([$user->id, $bob->id]);

    $convo3 = Conversation::create();
    $convo3->users()->attach([$user->id, $aia->id]);

    // 2. ACT: request the dashboard
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->get(route('dashboard'));

    // 3. ASSERT: all 3 conversations are sent to the frontend
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
    ->component('Home')
    ->has('conversations', 3)
    );

    
});