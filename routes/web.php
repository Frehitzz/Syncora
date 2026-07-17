<?php

use App\Http\Controllers\Controller;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\MessageController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [ConversationController::class, 'index'])->name('dashboard');

    // it give the messages of this conversation 
    Route::get('conversations/{conversation}/messages',
    [MessageController::class,'show'])
    ->name('conversations.messages');

    // save new mesage to this conversation
    Route::post('conversations/{conversation}/messages',
    [MessageController::class, 'store'])
    ->name('conversations.messages.store');
});

require __DIR__.'/settings.php';
