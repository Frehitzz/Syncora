<?php

namespace App\Jobs;

use App\Models\Message;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

// implements ShouldQueue - stop it to run immideately and put it in the queue first
class MarkMessageRead implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * ====== CONSTRUCTOR ========
     * - stores the conversation id and user id so the job knows what to update
     */
    public function __construct(
        public int $conversationId,
        public int $userId
    ) {
        //
    }

    /**
     * ====== HANDLE =======
     * - executes the actual db update when the queue worker picks up this job
     */
    public function handle(): void
    {
        /**
         * find all messages in this conversation that:
         * - were sent To this user (receiver_id)
         * - are still unread (is_read = false)
         * then flip them to is_read = true
         *
         * WHAT THIS CODE DO:
         * "Look in the Messages table and find all unread
         * messages sent to me in this specific conversation.
         * Once you find them, change them all to read."
         */
        Message::where('conversation_id', $this->conversationId)
            ->where('receiver_id', $this->userId)
            ->where('is_read', false)
            ->update(['is_read' => true]);
    }
}
