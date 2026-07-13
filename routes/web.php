<?php

use App\Http\Controllers\ConversationController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [ConversationController::class, 'index'])->name('dashboard');
});

require __DIR__.'/settings.php';
