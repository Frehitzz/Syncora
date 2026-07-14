<?php

use App\Http\Controllers\ConversationController;
use App\Http\Controllers\MessageController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [ConversationController::class, 'index'])->name('dashboard');

    // it give the messages of this conversation 
    Route::get('conversations/{conversation}/messages', [MessageController::class,'show'])
    ->name('conversations.messages');
});

require __DIR__.'/settings.php';
