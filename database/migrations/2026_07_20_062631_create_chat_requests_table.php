<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('chat_requests', function (Blueprint $table) {
            $table->id();
            // id for who sent the req point to users table
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            // id for who receives the request, points to users table
            $table->foreignId('receiver_id')->constrained('users')->cascadeOnDelete();
            // current status: will start as 'pending' can become accpeted or rejected
            $table->string('status')->default('pending');
            $table->timestamps();
            // prevent duplicate requests
            $table->unique(['sender_id', 'receiver_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_requests');
    }
};
