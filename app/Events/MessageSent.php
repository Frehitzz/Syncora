<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    // ====== constructor ========
    // message that was just sent - we store it here so we can broadcast it
    public function __construct(public Message $message)
    {
        //
    }

    // ========= broadcastOn =========
    // defines which channel this event should be broadcast on.
    // use PrivateChannel so only authorized users can listen
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('conversation.'.$this->message->conversation_id),
            new PrivateChannel('user.'.$this->message->receiver_id),
        ];
    }

    // ======= broadcastWith ========

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        // ======== broadcast data =========
        // it translate the value from db to a json format so react(frontend)
        // can understand it
        return [
            'id' => $this->message->id,
            'conversation_id' => $this->message->conversation_id,

            // go to the message table grab this message row and
            // look at the sender_id column in this message row
            // then go to the users table and get the name column
            'sender' => $this->message->sender->name,
            'content' => $this->message->body,
            'time' => $this->message->created_at->format('g:i A'),
            'isOwn' => false, // for the receiver, this message is NOT their own
        ];
    }
}
