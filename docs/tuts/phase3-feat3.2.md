# Phase 3 — Feature 3.2: Real-Time Message Delivery

In Feature 3.1, we set up the plumbing — the WebSocket server (Reverb) is running and Echo is connected and listening. But it's just sitting there with nothing to listen to yet.

Right now, when User A sends a message to User B, the message saves to the database — but User B has to **refresh the page** to see it. That's not real-time at all!

In this feature, we make messages appear **instantly** on the other user's screen the moment they are sent, without any page refresh. This is the heart of real-time messaging.

---

## 🧠 Before We Code: Understanding the Concepts

### What is a Laravel Event?

Think of a Laravel **Event** as a way of announcing to your whole application that something just happened.

Imagine a school with a PA system. When lunch is ready, someone picks up the PA and says: *"Lunch is now served!"* Everyone who is listening (the students) can hear that announcement and react to it (go to the cafeteria).

In Laravel:
- **The Event** = The PA announcement: *"A message was just sent!"*
- **Firing the event** = Picking up the PA and making the announcement
- **Listeners** = Code that reacts to the announcement (e.g., send an email, broadcast to the browser)

An Event is just a PHP class. It holds the data you want to announce (in our case, the message that was just sent).

---

### What is `ShouldBroadcast`?

By default, when you fire a Laravel event, it only runs inside your PHP code (for things like sending emails, writing logs, etc.). The browser knows nothing about it.

`ShouldBroadcast` is an **interface** that you add to your event class to tell Laravel: *"Hey, after you fire this event in PHP, I also want you to send it through the WebSocket server (Reverb) so the browser can hear it too!"*

Think of it like stamping a letter with "ALSO SEND A COPY BY TELEGRAPH." 

Without `ShouldBroadcast` → only your PHP code knows about the event.  
With `ShouldBroadcast` → both PHP AND the connected browsers hear about it in real-time.

---

### What is a Channel?

A **channel** is like a private chat room on a radio. Instead of broadcasting on a frequency that EVERYONE can hear, you broadcast on a specific frequency that only the right people are tuned in to.

For our chat app:
- Every conversation gets its own private channel: `conversation.1`, `conversation.2`, `conversation.5`, etc.
- When a message is sent in Conversation #5, we broadcast the event on the `conversation.5` channel.
- Only the users who are **in** Conversation #5 (and whose browsers are listening on that channel) will receive the event.

This is important for privacy! You don't want Alice's messages showing up in Bob and Charlie's chat.

---

### The Full Flow for This Feature

Here is the complete picture of what will happen after we build this:

```
1. User A types "Hello!" and clicks Send
         │
         ▼ (normal HTTP POST — already works!)
2. MessageController@store saves the message to the database
         │
         ▼ (NEW — this is what we're building)
3. Controller fires: event(new MessageSent($message))
         │
         ▼ (Laravel sees ShouldBroadcast)
4. Laravel sends the event data to Reverb (WebSocket server)
         │
         ▼ (Reverb pushes to the right people)
5. Reverb broadcasts on the "conversation.5" private channel
         │
         ▼ (Echo in User B's browser is listening on that channel)
6. User B's Echo receives the "MessageSent" event
         │
         ▼ (React updates the screen)
7. The new message instantly appears in User B's chat window 🎉
```

Steps 1–2 already exist. We're building steps 3–7 in this tutorial.

---

## Now Let's Build It! 🔨

---

## Step 1: Create the `MessageSent` Event

**What is this?**
We need to create the PHP class that represents our "PA announcement." This class will carry all the information about the message that was just sent (who sent it, what it says, which conversation it belongs to).

1. Run this command to generate the event file:
   ```bash
   php artisan make:event MessageSent
   ```
   This creates a new file at `app/Events/MessageSent.php`. Notice how Laravel automatically created the `app/Events/` folder for you!

2. Open `app/Events/MessageSent.php` and **replace the entire content** with:
   ```php
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

       // ========== constructor ===========
       // The message that was just sent — we store it here so we can broadcast it
       public function __construct(public Message $message)
       {
           // The "public" keyword on $message automatically makes it a public property.
           // This is a PHP 8 shortcut called "constructor promotion."
       }

       // ========== broadcastOn ===========
       // Defines WHICH channel this event should be broadcast on.
       // We use a PrivateChannel so only authorized users can listen.
       public function broadcastOn(): array
       {
           return [
               new PrivateChannel('conversation.' . $this->message->conversation_id),
           ];
       }

       // ========== broadcastWith ===========
       // Defines WHAT DATA gets sent to the browser with this event.
       // We return only what the frontend needs — no sensitive data!
       public function broadcastWith(): array
       {
           return [
               'id'      => $this->message->id,
               'sender'  => $this->message->sender->name,
               'content' => $this->message->body,
               'time'    => $this->message->created_at->format('g:i A'),
               'isOwn'   => false, // for the receiver, this message is NOT their own
           ];
       }
   }
   ```

   **Let's break down every part of this:**

   #### `implements ShouldBroadcast`
   This is the magic line. It tells Laravel: *"This event should not just run in PHP — it should also be sent through the WebSocket server to any connected browser that is listening."*

   #### The three `use` traits
   - `Dispatchable` — Gives us the `event(new MessageSent(...))` syntax to fire the event
   - `InteractsWithSockets` — Required by Laravel's broadcasting system to work properly
   - `SerializesModels` — Makes it safe to pass a Laravel model (`$message`) into the event. It converts the model into something that can be sent over a queue job without issues.

   #### `public function __construct(public Message $message)`
   When we fire the event later, we pass in the message like this: `new MessageSent($message)`. The `public` keyword before `$message` is a PHP 8 shortcut that says "store this as a public property automatically." So `$this->message` will be available everywhere inside this class.

   #### `broadcastOn()`
   This method answers the question: **"Which channel should I broadcast on?"**

   We return a `PrivateChannel` with the name `conversation.5` (if the conversation ID is 5). By using `PrivateChannel` (not just `Channel`), Laravel will automatically require the user to be authorized before they can listen. This is the security that `routes/channels.php` provides.

   #### `broadcastWith()`
   This method answers the question: **"What data should I send to the browser?"**

   We format the message the same way `MessageController@show` does — because the frontend already knows how to read this format (it has an `id`, `sender`, `content`, `time`, and `isOwn`). Notice we hardcode `'isOwn' => false`. This is because this event is received by the **other person** (User B), so for them, this message is definitely not their own!

   > **Why not just send `$this->message` directly?**  
   > Because the `Message` model object contains things you might not want to expose (like database IDs for sensitive data). `broadcastWith()` lets you pick exactly what gets sent to the browser — nothing more, nothing less.

---

## Step 2: Load the Sender Relationship Before Broadcasting

**Why do we need this?**
Inside `broadcastWith()`, we call `$this->message->sender->name`. This means Laravel needs to know who the `sender` is — it needs to go to the `users` table and fetch their name.

If the `sender` relationship hasn't been loaded yet, calling `->sender->name` will trigger a separate database query automatically. That's fine, but there's a small risk: by the time the event is processed (especially if it goes through a queue), the relationship might fail.

The safest fix is to **eagerly load** the sender when we create the event. We'll do this in the next step inside the controller.

---

## Step 3: Fire the Event in `MessageController@store`

**Why do we need this?**
Creating an event class does nothing on its own — it's just a blueprint. We need to actually **fire** it (make the announcement) at the right moment. That right moment is right after we save the message to the database.

Open `app/Http/Controllers/MessageController.php` and update the `store` method:

```php
<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;   // ← ADD THIS IMPORT
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    // ====== show ========
    // fetch and return all messages for specific conversation
    // we use JsonResponse bc we only fetch the data, here we use AJAX req and it needs raw data (JSON)
    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        // ... (leave the show method exactly as it is, no changes needed here)
    }

    // =========== store =========
    // validate, save, and broadcast a new message for the conversation
    public function store(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        // make sure logged in user belong to this convo
        if (!$conversation->users()->where('user_id', $user->id)->exists()) {
            abort(403, 'You do not belong to this conversation');
        }

        // validate: make sure message is not empty
        $validated = $request->validate([
            'body' => 'required|string|max:5000',
        ]);

        // figure out who the other person in this conversation is
        $receiverId = $conversation->users()
            ->where('user_id', '!=', $user->id)
            ->value('user_id');

        // save message to db
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id'       => $user->id,
            'receiver_id'     => $receiverId,
            'body'            => $validated['body'],
            'is_read'         => false,
        ]);

        // ← ADD THESE TWO LINES ─────────────────────────────────────────────
        // Load the sender relationship so broadcastWith() can access $message->sender->name
        $message->load('sender');

        // Fire the MessageSent event — Reverb will push it to the conversation channel
        event(new MessageSent($message));
        // ───────────────────────────────────────────────────────────────────

        // return the translated format that frontend expects
        return response()->json([
            'id'      => $message->id,
            'sender'  => $user->name,
            'content' => $message->body,
            'time'    => $message->created_at->format('g:i A'),
            'isOwn'   => true,
        ], 201);
    }
}
```

**What's new here:**

#### `use App\Events\MessageSent;`
This import at the top tells PHP: "When I write `MessageSent`, look for the class inside `app/Events/MessageSent.php`." Without this, PHP wouldn't know what `MessageSent` is and would crash with a "class not found" error.

#### `$message->load('sender');`
This is **eager loading** — we're telling Laravel: "Before you do anything else with this message, go to the `users` table right now and fetch the sender's name and attach it to the `$message` object." This way, when `broadcastWith()` calls `$this->message->sender->name`, it doesn't need an extra database query.

#### `event(new MessageSent($message));`
This is how you fire an event in Laravel. 
- `new MessageSent($message)` — creates a new instance of our event class, passing in the saved message
- `event(...)` — a global Laravel helper that fires the event. Laravel then checks: "Does this event implement `ShouldBroadcast`?" YES → sends it to Reverb → Reverb pushes it to the browser!

**The order matters:** We fire the event AFTER saving the message and AFTER returning the response to the sender. Actually, the event is fired before `return response()->json(...)`, but that's intentional. Laravel with queues would handle this non-blocking, but for now it runs synchronously — the sender just waits a millisecond more, which is imperceptible.

---

## Step 4: Authorize the Private Channel

**Why do we need this?**
When User B's Echo tries to listen on `conversation.5`, Reverb will ask Laravel: *"Is this user allowed to listen on this channel?"* 

Without an authorization rule in `routes/channels.php`, Laravel will say "No" by default and block the connection! We need to add a rule that says: "If the user is a participant of this conversation, let them in."

Open `routes/channels.php` and add the new channel rule:

```php
<?php

use App\Models\Conversation;
use Illuminate\Support\Facades\Broadcast;

// only let user listen to this private websocket channel
// if their actual logged-in user id matches the id in the channel name
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// ← ADD THIS BLOCK ──────────────────────────────────────────────────────────
// Authorize the conversation private channel.
// Only allow a user to listen if they are a participant of this conversation.
Broadcast::channel('conversation.{conversationId}', function ($user, $conversationId) {
    // Find the conversation in the database
    $conversation = Conversation::find($conversationId);

    // If the conversation doesn't exist, deny access
    if (! $conversation) {
        return false;
    }

    // Check if the logged-in user is a member of this conversation
    // If yes, return true (access granted). If no, return false (denied).
    return $conversation->users()->where('user_id', $user->id)->exists();
});
// ────────────────────────────────────────────────────────────────────────────
```

**What this does step by step:**
1. When User B's browser tries to connect to `conversation.5`, Reverb sends a request to Laravel asking "Is this user authorized?"
2. Laravel looks in `channels.php` for a rule matching `conversation.{conversationId}`. It finds our new rule with `$conversationId = 5`.
3. Our function runs: it finds Conversation #5, then checks if User B is a member.
4. If yes → `return true` → Reverb opens the channel for User B.
5. If no → `return false` → Reverb rejects the connection. User B can't listen in!

> **This is your security checkpoint.** Without this, anyone who knows a conversation ID could listen to that conversation's WebSocket channel!

---

## Step 5: Listen for the Event in React (`Home.tsx`)

**Why do we need this?**
The backend is now firing the event and Reverb is broadcasting it. But User B's browser doesn't know what to do with it yet! We need to write React code that says: *"Echo, please listen on the conversation channel, and whenever a `MessageSent` event arrives, add the message to the chat."*

Open `resources/js/pages/Home.tsx` and find the `selectConversation` function (around line 290). 

We need to add a `useEffect` hook that sets up the Echo listener whenever the active conversation changes. Add this **right after** the `selectConversation` function and **before** the existing `useEffect` that loads messages on page load:

```tsx
// ========== REAL-TIME MESSAGE LISTENER ==========
// Whenever the active conversation changes, we subscribe to its WebSocket channel.
// When a new MessageSent event arrives, we add the message to the chat.
useEffect(() => {
    // Don't set up a listener if there's no active conversation
    if (!activeConvo) return;

    // Subscribe to the private channel for this conversation
    // "private" means the user must be authorized (checked in channels.php)
    const channel = window.Echo.private(`conversation.${activeConvo.id}`)
        .listen('MessageSent', (data: Message) => {
            // "data" contains everything we returned in broadcastWith():
            // { id, sender, content, time, isOwn }
            // Add the incoming message to the end of the chat list
            setChatMessages((prev) => [...prev, data]);
        });

    // CLEANUP FUNCTION:
    // When the user clicks a different conversation (activeConvo changes),
    // React will run this cleanup function FIRST to unsubscribe from the old channel.
    // This prevents us from listening to 5 different channels at once!
    return () => {
        window.Echo.leave(`conversation.${activeConvo.id}`);
    };
}, [activeConvo]); // Re-run this effect every time activeConvo changes
```

**Let's break this down line by line:**

#### `useEffect(() => { ... }, [activeConvo])`
`useEffect` is a React hook that runs a piece of code as a "side effect." The `[activeConvo]` at the end is the **dependency array** — it tells React: *"Only re-run this code when `activeConvo` changes."* So every time you click a different conversation in the sidebar, this code runs again to set up the listener for the new conversation (and clean up the old one).

#### `window.Echo.private('conversation.5')`
This tells Echo: *"I want to subscribe to a private channel called `conversation.5`."* The word `private` means Echo will first ask your Laravel backend (via a special auth request to `/broadcasting/auth`) whether this user is allowed to join. If `channels.php` returns `true`, the subscription is opened. If it returns `false`, it's rejected.

#### `.listen('MessageSent', (data: Message) => { ... })`
This tells Echo: *"While subscribed to this channel, if you receive an event called `MessageSent`, run this callback function."* The `data` parameter contains exactly what we returned from `broadcastWith()` in our event class.

> **Wait — where does the event name "MessageSent" come from?**  
> By default, Laravel takes the class name (`MessageSent`) and uses that as the event name. The frontend just needs to know the same name. Simple!

#### `setChatMessages((prev) => [...prev, data])`
This is the React state update that makes the magic happen visually. `prev` is the current list of messages. We create a **new array** by spreading all the old messages (`...prev`) and adding the new `data` at the end. React detects this state change and re-renders the chat window, showing the new message instantly!

#### The cleanup function (`return () => { window.Echo.leave(...) }`)
This is critical! When you switch conversations, React runs this cleanup function. `window.Echo.leave(channelName)` tells Echo: *"Unsubscribe me from this channel."* Without this, you'd accumulate Echo listeners and would receive duplicate messages or messages from the wrong conversation!

---

## Step 6: Test It Manually in the Browser

Before running automated tests, let's verify it works visually.

1. Make sure all 4 servers are running (`composer dev`)
2. Open your app in **two different browser windows** (or one normal window + one incognito window)
3. Log in as **User A** in one window and **User B** in the other
4. Both users should have an existing conversation with each other
5. Open that conversation in both windows
6. Open the **Developer Tools** (F12) in both windows, go to the **Network** tab, and filter by **WS**. You should see active WebSocket connections.
7. In User A's window, type a message and click Send
8. Watch User B's window — **the message should appear instantly without any refresh!** 🎉

If it works, you've built real-time messaging! If not, check the browser Console tab for any errors.

**Common issues:**
- **"Echo is not defined"** — Make sure `import './echo';` is in `app.tsx`
- **No WebSocket connection in Network tab** — Make sure Reverb is running (`php artisan reverb:start`)
- **Event fires but message doesn't appear** — Check that the channel name in `broadcastOn()` exactly matches the channel name in your React `Echo.private()` call
- **"Unauthorized" error in Console** — Check that you added the channel rule to `routes/channels.php` and that `bootstrap/app.php` loads the channels file

---

## Step 7: Write a Pest Test to Verify the Event is Dispatched

**Why do we need this?**
We can't test real WebSocket connections in an automated test (there's no browser), but we CAN verify that the `MessageSent` event is **fired** when a message is sent. Laravel gives us a tool called `Event::fake()` that pretends to fire events without actually sending them — then we can assert they were triggered.

Think of `Event::fake()` like a "flight recorder" for events. Instead of actually broadcasting to Reverb, it just notes down: "Hey, someone tried to fire MessageSent with this data." We can then check those notes in our assertions.

Create a new test file:
```bash
php artisan make:test MessageSentEventTest
```

Open `tests/Feature/MessageSentEventTest.php` and replace the content with:

```php
<?php

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

// ======= VERIFY THE EVENT FIRES WHEN A MESSAGE IS SENT ==========
test('MessageSent event is dispatched when a user sends a message', function () {
    // 1. TELL LARAVEL TO FAKE ALL EVENTS (don't actually broadcast, just record)
    //    This is like telling the post office: "Don't actually deliver any letters.
    //    Just write down that someone tried to send them."
    Event::fake();

    // 2. ARRANGE: set up two users and a conversation
    /** @var \App\Models\User $user */
    $user = User::factory()->create();

    /** @var \App\Models\User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 3. ACT: send a message via the API (same as a real user clicking Send)
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => 'Hello in real-time!']
    );

    // 4. ASSERT: the response is successful
    $response->assertCreated();

    // 5. ASSERT: the MessageSent event was dispatched exactly once
    //    Event::assertDispatched() checks the "post office records"
    //    and verifies that MessageSent was attempted to be sent
    Event::assertDispatched(MessageSent::class, function (MessageSent $event) {
        // Also verify that the event contains the correct message text
        return $event->message->body === 'Hello in real-time!';
    });
});

// ======= VERIFY THE EVENT IS NOT FIRED FOR UNAUTHORIZED USERS ==========
test('MessageSent event is NOT dispatched if user does not belong to the conversation', function () {
    // 1. Fake events so we can check if they were (or weren't) fired
    Event::fake();

    // 2. ARRANGE: user is NOT part of this conversation
    /** @var \App\Models\User $outsider */
    $outsider = User::factory()->create();

    /** @var \App\Models\User $member1 */
    $member1 = User::factory()->create();

    /** @var \App\Models\User $member2 */
    $member2 = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$member1->id, $member2->id]);

    // 3. ACT: try to send a message as the outsider
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($outsider)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => 'I am not allowed here!']
    );

    // 4. ASSERT: access is denied
    $response->assertForbidden();

    // 5. ASSERT: the event was NOT fired (because the message was never saved)
    Event::assertNotDispatched(MessageSent::class);
});
```

**Breaking down the test concepts:**

#### `Event::fake()`
This is the magic command. After calling this, Laravel will **intercept all events** and record them without actually doing anything (no Reverb, no emails, no nothing). It's a "flight simulator" for events — everything looks real but nothing actually leaves the ground.

#### `Event::assertDispatched(MessageSent::class, function (MessageSent $event) { ... })`
This checks the recording and says: *"Was `MessageSent` fired? Yes? Good. Now also run this callback to verify the data inside it was correct."* The callback receives the actual event object, so you can inspect its properties (`$event->message->body`).

#### `Event::assertNotDispatched(MessageSent::class)`
The opposite — this verifies that the event was **never fired**. We use this to confirm that unauthorized users can't trigger broadcasts.

Now run the test:
```bash
php artisan test tests/Feature/MessageSentEventTest.php
```

You should see two green **PASS** results! ✅

---

## ✅ Feature 3.2 Checklist

- [ ] Created `app/Events/MessageSent.php` with `ShouldBroadcast`
- [ ] Added `broadcastOn()` returning a `PrivateChannel('conversation.{id}')`
- [ ] Added `broadcastWith()` returning the formatted message data
- [ ] Updated `MessageController@store` to import and fire `event(new MessageSent($message))`
- [ ] Added `$message->load('sender')` before firing the event
- [ ] Added the `conversation.{conversationId}` authorization rule to `routes/channels.php`
- [ ] Added the `useEffect` real-time listener in `Home.tsx` using `window.Echo.private(...).listen(...)`
- [ ] Added the cleanup function `window.Echo.leave(...)` in the `useEffect` return
- [ ] Verified real-time messaging works by testing with two browser windows
- [ ] Wrote and passed `MessageSentEventTest.php`

---

## 🔮 What's Next? (Feature 3.3 Preview)

Your app now has real-time message delivery! In **Feature 3.3**, you'll build the **online/offline status** indicator:
- The green dot on avatars will update in real-time as users come online and go offline.
- You'll learn about **Presence Channels** — a special type of channel that tracks who is connected.
- You'll use Echo's `here()`, `joining()`, and `leaving()` callbacks.

The skill you learned today (listening for events in Echo) will be the foundation for that too!

---

> **Tip:** If you open the browser's Network tab and filter by WS (WebSocket), you can watch the real-time messages flowing through the WebSocket connection as you type and send them. It's very satisfying to see it working live!
