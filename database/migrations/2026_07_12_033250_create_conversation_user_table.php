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
        Schema::create('conversation_user', function (Blueprint $table) {
            // this one is pointing to conversation table id
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            // this one is pointing to user table user id
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            // ===== VALUE THAT WILL STORE =====
            // conversation_id: 02 | user_id: 5
            // conversation_id: 02 | user_id: 8
            // meaning user 5 and 8 are talking to each other

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('conversation_user');
    }
};
