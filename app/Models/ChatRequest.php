<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatRequest extends Model
{
    // only these columns are allowed to be filled in when creating/updating a record
    protected $fillable = ['sender_id', 'receiver_id', 'status'];

    // ======== SENDER =========
    /**
     * Get the user who sent this chat request
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo<User, $this>
     */

    public function sender():BelongsTo{
        return $this->belongsTo(User::class,'sender_id');
    }

    // ====== RECEIVER ======
    /**
     * Get the user who received this chat request
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo<User, $this>
     */

    public function receiver():BelongsTo{
        return $this->belongsTo(User::class, 'receiver_id');
    }
}
