<?php

use App\Http\Controllers\ChatRequestController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [ConversationController::class, 'index'])->name('dashboard');

    // it give the messages of this conversation
    Route::get('conversations/{conversation}/messages',
        [MessageController::class, 'show'])
        ->name('conversations.messages');

    // save new mesage to this conversation
    Route::post('conversations/{conversation}/messages',
        [MessageController::class, 'store'])
        ->name('conversations.messages.store');

    Route::post('conversations/{conversation}/mark-read',
        [MessageController::class, 'markAsRead'])
        ->name('conversations.mark-read');

    Route::get('users/search', [UserController::class, 'search'])->name('users.search');

    Route::post('conversations', [ConversationController::class, 'store'])->name('conversations.store');

    // get all pending chat request (for bell icon)
    Route::get('chat-requests/pending',
        [ChatRequestController::class, 'pending'])->name('chat-requests.pending');

    // send new chat request
    Route::post('chat-requests',
        [ChatRequestController::class, 'store'])->name('chat-requests.store');

    // accept a chat request (we use PAtCh because were only updating the status not creating new)
    Route::patch('chat-requests/{chatRequest}/accept',
        [ChatRequestController::class, 'accept'])->name('chat-requests.accept');

    // reject a chat request
    Route::patch('chat-requests/{chatRequest}/reject',
        [ChatRequestController::class, 'reject'])->name('chat-requests.reject');

});

require __DIR__.'/settings.php';
