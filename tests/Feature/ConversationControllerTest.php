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