<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    protected $fillable = [
        'conversation_id',
        'sender_id',
        'receiver_id',
        'body',
        'is_read',
    ];

    // ========== conversation ===========
    // Get the conversation that this message belongs to
    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    // ========== sender ===========
    // Get the user who sent the message
    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function receiver()
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }
}
