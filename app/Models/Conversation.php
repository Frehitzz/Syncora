<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    // ========== users ===========
    // Get the users that are part of this conversation
    public function users()
    {
        return $this->belongsToMany(User::class);
    }

    // ========== messages ===========
    // Get all messages sent within this conversation
    public function messages()
    {
        return $this->hasMany(Message::class);
    }
}
