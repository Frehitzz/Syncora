<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

// ======= MESSAGES READ =======
// - broadcast evente that notifies conversation participants when messages have been read
class MessagesRead implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * ======== constructor ========
     * - stores the conversation ID and the user ID of who read the messages
     */
    public function __construct(
        public int $conversationId,
        public int $readByUserId
    ) {
        //
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     *
     * ======= broadcastOn =======
     * - defines which channel this event should be broadcast on
     */
    public function broadcastOn(): array
    {
        // use the same private conversation channel that MessageSent uses
        return [
            new PrivateChannel('conversation.'.$this->conversationId),
        ];
    }

    /**
     * ======== broadcastWith =========
     * - the data payload that gets sent to frontend
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            // conversation_id & read_by_user_id - are parameter for the front end to call and use
            'conversation_id' => $this->conversationId,
            'read_by_user_id' => $this->readByUserId,
        ];
    }
}
