<?php

use Illuminate\Support\Facades\Broadcast;

// only let user listen to this private websocket channel
// if their acutal logged-in user id matches the id in the channel name
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});
