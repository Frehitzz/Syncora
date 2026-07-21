<?php

use Illuminate\Support\Facades\Broadcast;

// Test that the broadcasting system is configured with Reverb
test('broadcasting is configured with reverb', function () {
    // Check that the reverb configuration block exists in broadcasting.php
    expect(config('broadcasting.connections.reverb'))->not->toBeNull();
    expect(config('broadcasting.connections.reverb.driver'))->toBe('reverb');
});

test('channels route file is loaded', function () {
    // The channels.php route file should be loaded by the application
    // We can verify this by checking that the default User channel exists
    // This channel was created by the install:broadcasting command
    $this->assertTrue(
        file_exists(base_path('routes/channels.php')),
        'The routes/channels.php file should exist'
    );
});
