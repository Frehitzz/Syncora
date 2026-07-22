<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Test\TestCase;

uses(RefreshDatabase::class);

test('user can search for other users by name',
    function () {
        /** @var User $user */
        $user = User::factory()->create();

        User::factory()->create(['name' => 'Alice Smith']);
        User::factory()->create(['name' => 'Bob Jones']);

        /** @var \Tests\TestCase\ $this */
        $response = $this->actingAs($user)->getJson('/users/search?query=Alice');

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonFragment(['name' => 'Alice Smith']);
        $response->assertJsonMissing(['name' => 'Bob Jones']);
    });

test('search does not return the logged in user',
    function () {
        /** @var TestCase $this */
        $user = User::factory()->create(['name' => 'Charlie Charlie']);

        /** @var \Tests\TestCase\ $this */
        $response = $this->actingAs($user)->getJson('/users/search?query=Charlie');

        $response->assertOk();
        $response->assertJsonCount(0); // it is zero becasue we exclude outselves

    });
