# Phase 4 — Feature 4.2: Mark Messages as Read (Unread Badge & Read Receipts)

Right now, when someone sends you a message, it arrives in the chat and the `is_read` column stays `false` forever. The sidebar shows `unread: 0` as a hardcoded placeholder — no matter how many unread messages you actually have, the badge never appears. When you open a conversation, nothing tells the backend "hey, I've seen these."

In this feature, we'll make the unread badge **real**. The sidebar will show a red badge with the actual count of unread messages. When you open a conversation, all unread messages will be marked as read, the badge will disappear, and the sender will receive a real-time broadcast so they know their messages were seen.

---

## 🧠 Before We Code: Understanding the Concepts

### What is a "Read Receipt" System?

Think of it like registered mail at the post office. When you send a registered letter, you get a little card back saying "the recipient picked it up on July 22nd." You know they received it. Without that card, you're just hoping they got it.

In our chat app, every message has an `is_read` boolean column — like a "delivery receipt" stamp. When it's `false`, the sender hasn't received confirmation. When the receiver opens the conversation, we stamp all messages as `is_read = true` and broadcast a "MessagesRead" event back to the sender — that's the card coming back from the post office.

### What is a Queued Job for Batch Updates?

Imagine a teacher collecting 30 homework papers. Instead of grading each one immediately as students hand them in (blocking the class), the teacher puts them in a "to-grade" pile and grades them during a free period.

A **queued job** works the same way. When a user opens a conversation with 50 unread messages, we don't want to update all 50 rows right there in the HTTP request (making the user wait). Instead, we push the heavy database work into a background queue. The user sees the conversation instantly, and the database update happens behind the scenes.

In Laravel, this means creating a `MarkMessagesRead` job class and dispatching it with `MarkMessagesRead::dispatch(...)`. The queue worker (`php artisan queue:work`) picks it up and runs it asynchronously.

### What is an Unread Count Query?

When loading the sidebar conversation list, we need to count how many messages in each conversation are `is_read = false` AND were sent TO the current user (you don't want to count your own messages as "unread"). This is a `withCount()` query in Eloquent — it adds a virtual `messages_count` attribute to each conversation without loading all the message rows.

---

### The Full Flow for This Feature

Here is the complete picture of what will happen after we build this:

```
1. User clicks on a conversation in the sidebar
        │
        ▼ (already works)
2. selectConversation() fires → fetches messages via GET /conversations/{id}/messages
        │
        ▼ (NEW — this is what we're building)
3. Frontend sends POST /conversations/{id}/mark-read to the backend
        │
        ▼ (NEW)
4. MarkReadController dispatches MarkMessagesRead job to the queue
        │
        ▼ (NEW — background job)
5. MarkMessagesRead job updates all is_read = false → true for this user in this conversation
        │
        ▼ (NEW — broadcast)
6. MessagesRead event is broadcast to the conversation channel
        │
        ▼ (NEW — frontend listens)
7. Sender's browser receives the event and could update UI (future: read receipts ✓✓)
        │
        ▼ (NEW — sidebar update)
8. Frontend sets unread count to 0 for the opened conversation 🎉
```

Steps 1–2 already exist. We're building steps 3–8 in this tutorial.

---

## Now Let's Build It! 🔨

---

## Step 1: Create the `MarkMessagesRead` Job

**What is this?**
This is the background worker that does the heavy database lifting. Instead of making the user wait while we update potentially hundreds of rows, we push this task to the queue. The job finds all unread messages sent TO the current user in a specific conversation and flips them to `is_read = true`.

1. Run the Artisan command to generate the job class:
   ```bash
   php artisan make:job MarkMessagesRead
   ```
   This creates a new file at `app/Jobs/MarkMessagesRead.php` with the boilerplate for a queueable job.

2. Open `app/Jobs/MarkMessagesRead.php` and replace its contents with:

   ```php
   <?php

   namespace App\Jobs;

   use App\Models\Message;
   use Illuminate\Bus\Queueable;
   use Illuminate\Contracts\Queue\ShouldQueue;
   use Illuminate\Foundation\Bus\Dispatchable;
   use Illuminate\Queue\InteractsWithQueue;
   use Illuminate\Queue\SerializesModels;

   // ========== MarkMessagesRead ===========
   // Background job that marks all unread messages in a conversation as read for a specific user
   class MarkMessagesRead implements ShouldQueue
   {
       use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

       // ========== constructor ===========
       // Stores the conversation ID and user ID so the job knows what to update
       public function __construct(
           public int $conversationId,
           public int $userId
       ) {
           //
       }

       // ========== handle ===========
       // Executes the actual database update when the queue worker picks up this job
       public function handle(): void
       {
           // find all messages in this conversation that:
           // 1. were sent TO this user (receiver_id)
           // 2. are still unread (is_read = false)
           // then flip them all to is_read = true
           Message::where('conversation_id', $this->conversationId)
               ->where('receiver_id', $this->userId)
               ->where('is_read', false)
               ->update(['is_read' => true]);
       }
   }
   ```

   **Let's break down every part of this:**

   #### `implements ShouldQueue`
   This interface tells Laravel "don't run this immediately — put it on the queue." Without this, the job would run synchronously (defeating the purpose). With it, Laravel serializes the job data and pushes it to your configured queue driver (database, Redis, etc.).

   #### `public int $conversationId, public int $userId`
   We use PHP constructor promotion to store the IDs. We pass **IDs** (integers) instead of full model objects because IDs are tiny to serialize. The job gets serialized to JSON and stored in the `jobs` table — you don't want to stuff a whole Eloquent model in there.

   #### `->where('receiver_id', $this->userId)->where('is_read', false)`
   This is critical — we only mark messages where the **current user is the receiver**. You don't want to mark your own sent messages as "read" (they're already yours). And we only update messages that are still unread to avoid unnecessary writes.

   #### `->update(['is_read' => true])`
   This is a mass update — one SQL query for all matching rows. Much faster than loading each message, changing it, and saving it one by one.

   > **Why not just update inline in the controller?**
   > For a conversation with 5 messages, inline updates would be fine. But what about a conversation with 500 unread messages? That `UPDATE` query could take noticeable time. By queueing it, the user sees the conversation instantly while the database catches up in the background.

---

## Step 2: Create the `MessagesRead` Event

**What is this?**
After messages are marked as read, we need to tell the sender in real time. This broadcast event travels through the WebSocket so the sender's browser knows "your messages were seen." This is the foundation for future "read receipt" checkmarks (✓✓).

1. Run the Artisan command to generate the event:
   ```bash
   php artisan make:event MessagesRead
   ```
   This creates a new file at `app/Events/MessagesRead.php`.

2. Open `app/Events/MessagesRead.php` and replace its contents with:

   ```php
   <?php

   namespace App\Events;

   use Illuminate\Broadcasting\InteractsWithSockets;
   use Illuminate\Broadcasting\PrivateChannel;
   use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
   use Illuminate\Foundation\Events\Dispatchable;
   use Illuminate\Queue\SerializesModels;

   // ========== MessagesRead ===========
   // Broadcast event that notifies conversation participants when messages have been read
   class MessagesRead implements ShouldBroadcast
   {
       use Dispatchable, InteractsWithSockets, SerializesModels;

       // ========== constructor ===========
       // Stores the conversation ID and the user ID of who read the messages
       public function __construct(
           public int $conversationId,
           public int $readByUserId
       ) {
           //
       }

       // ========== broadcastOn ===========
       // Defines which channel this event should be broadcast on
       public function broadcastOn(): array
       {
           // use the same private conversation channel that MessageSent uses
           return [
               new PrivateChannel('conversation.'.$this->conversationId),
           ];
       }

       /**
        * ========== broadcastWith ===========
        * The data payload that gets sent to the frontend
        *
        * @return array<string, mixed>
        */
       public function broadcastWith(): array
       {
           return [
               'conversation_id' => $this->conversationId,
               'read_by_user_id' => $this->readByUserId,
           ];
       }
   }
   ```

   **Let's break down every part of this:**

   #### `implements ShouldBroadcast`
   Just like `MessageSent`, this makes the event go through the WebSocket (Reverb). Without this, the event would only fire server-side and the frontend would never hear about it.

   #### `new PrivateChannel('conversation.'.$this->conversationId)`
   We reuse the same channel as `MessageSent`. Since both users are already subscribed to this channel for receiving messages, they'll automatically receive read receipt events too — no new channel setup needed.

   #### `broadcastWith()`
   We send the `conversation_id` (so the frontend knows which conversation was affected) and `read_by_user_id` (so the sender knows WHO read their messages). This is minimal data — just enough for the frontend to update the UI.

   > **Do I need to create a new channel in channels.php?**
   > No! The `conversation.{conversationId}` channel is already authorized in `routes/channels.php`. Since `MessagesRead` broadcasts on the same channel, the existing authorization applies automatically.

---

## Step 3: Create the Mark-Read Controller Method

**What is this?**
We need an HTTP endpoint that the frontend can call when a user opens a conversation. This endpoint dispatches the `MarkMessagesRead` job and broadcasts the `MessagesRead` event. We'll add a new method to the existing `MessageController` since it's message-related functionality.

1. Open `app/Http/Controllers/MessageController.php` and add the following imports at the top (merge with existing imports):

   ```php
   <?php

   namespace App\Http\Controllers;

   use App\Events\MessageSent;
   use App\Events\MessagesRead;       // ← ADD THIS
   use App\Jobs\MarkMessagesRead;     // ← ADD THIS
   use App\Models\Conversation;
   use App\Models\Message;
   use App\Models\User;
   use Illuminate\Http\JsonResponse;
   use Illuminate\Http\Request;
   ```

2. Add the following method at the bottom of the `MessageController` class, **after** the existing `store` method:

   ```php
       // ========== markAsRead ===========
       // Marks all unread messages in a conversation as read for the authenticated user
       public function markAsRead(Request $request, Conversation $conversation): JsonResponse
       {
           /** @var User $user */
           $user = $request->user();

           // make sure logged in user belongs to this conversation
           if (! $conversation->users()->where('user_id', $user->id)->exists()) {
               abort(403, 'You do not belong to this conversation.');
           }

           // dispatch the job to mark messages as read in the background
           // this pushes the heavy DB update to the queue so the user doesn't wait
           MarkMessagesRead::dispatch($conversation->id, $user->id);

           // broadcast to the conversation channel so the sender knows their messages were seen
           broadcast(new MessagesRead($conversation->id, $user->id))->toOthers();

           return response()->json(['status' => 'messages marked as read']);
       }
   ```

   **Let's break down every part of this:**

   #### The authorization check
   Same pattern as `show()` and `store()` — before doing anything, we verify the user belongs to this conversation. This prevents someone from marking messages as read in a conversation they shouldn't have access to.

   #### `MarkMessagesRead::dispatch($conversation->id, $user->id)`
   This pushes the job onto the queue. The `dispatch()` method serializes the job with the conversation ID and user ID, stores it in the queue (the `jobs` table if using the database driver), and returns immediately. The actual database update happens later when the queue worker processes it.

   #### `broadcast(new MessagesRead(...))->toOthers()`
   `toOthers()` is important — we don't want to broadcast back to the user who just opened the conversation (they already know they read the messages). We only want the OTHER person (the sender) to receive the event.

   > **Why not just put the database update directly in the controller?**
   > We could, and for small apps it would work fine. But the roadmap specifically asks us to queue it, and it's good practice — if a conversation has hundreds of unread messages, the update could be slow. Dispatching to a queue keeps the HTTP response fast (under 100ms).

---

## Step 4: Register the Route

**What is this?**
The frontend needs a URL to call when a conversation is opened. We'll add a POST route that points to our new `markAsRead` method. We use POST (not GET) because this action changes data on the server.

1. Open `routes/web.php` and add the new route inside the `auth` middleware group. Place it right after the existing `conversations/{conversation}/messages` routes:

   ```php
   Route::middleware(['auth', 'verified'])->group(function () {
       Route::get('dashboard', [ConversationController::class, 'index'])->name('dashboard');

       // it give the messages of this conversation
       Route::get('conversations/{conversation}/messages',
           [MessageController::class, 'show'])
           ->name('conversations.messages');

       // save new mesage to this conversation
       Route::post('conversations/{conversation}/messages',
           [MessageController::class, 'store'])
           ->name('conversations.messages.store');

       // mark all unread messages as read when user opens a conversation     ← ADD THIS
       Route::post('conversations/{conversation}/mark-read',                 // ← ADD THIS
           [MessageController::class, 'markAsRead'])                         // ← ADD THIS
           ->name('conversations.mark-read');                                // ← ADD THIS

       // ... (leave the rest as-is) ...
   });
   ```

   **Let's break down every part of this:**

   #### `Route::post(...)`
   We use POST because this endpoint modifies data (updating `is_read` flags). GET requests should never change data — that's an HTTP convention.

   #### `->name('conversations.mark-read')`
   Named routes let us reference this URL cleanly in tests: `route('conversations.mark-read', $conversation)` instead of hardcoding `/conversations/5/mark-read`.

---

## Step 5: Update the Conversation List to Show Real Unread Counts

**What is this?**
Right now, the `ConversationController@index` hardcodes `'unread' => 0` for every conversation. We need to replace that with an actual count of unread messages where `receiver_id` is the current user and `is_read` is `false`.

1. Open `app/Http/Controllers/ConversationController.php` and update the `index` method. Find the `$conversations` query and add a `withCount` clause, then use the count in the `map()`:

   ```php
   // ========== index ===========
   // Fetch and return the authenticated user's conversations
   public function index(Request $request): Response
   {

       /** @var User $user */
       // figure out who is currently logged in user then store it
       $user = $request->user();

       // ======= QUERYING, OPTIMIZING & FORMATTING ==========
       $conversations = $user->conversations()->with(['users', 'messages' => function ($query) {
           $query->latest()->limit(1);
       }])
           // count only unread messages where the current user is the receiver     ← ADD THIS
           ->withCount(['messages as unread_count' => function ($query) use ($user) {  // ← ADD THIS
               $query->where('receiver_id', $user->id)                                 // ← ADD THIS
                   ->where('is_read', false);                                           // ← ADD THIS
           }])                                                                          // ← ADD THIS
           ->get()

           ->map(function (Conversation $conversation) use ($user) {
               $otherUser = $conversation->users->firstWhere('id', '!=', $user->id);

               // get the latest message
               $lastMessage = $conversation->messages->first();

               return [
                   'id' => $conversation->id,
                   'otherUserId' => $otherUser ? $otherUser->id : null,
                   'name' => $otherUser ? $otherUser->name : 'Saved Messages',
                   'lastMessage' => $lastMessage ? $lastMessage->body : '',
                   'time' => $lastMessage ? $lastMessage->created_at->diffForHumans(short: true) : '',
                   'avatar' => $otherUser ? strtoupper(substr($otherUser->name, 0, 2)) : 'SM',
                   'unread' => $conversation->unread_count,  // ← CHANGE THIS (was hardcoded 0)
                   'online' => false, // placeholder for now
               ];
           });

       return Inertia::render('Home', ['conversations' => $conversations]);
   }
   ```

   **Let's break down every part of this:**

   #### `->withCount(['messages as unread_count' => function ($query) use ($user) { ... }])`
   `withCount()` tells Eloquent: "while you're fetching conversations, also run a COUNT query on the messages table." The `as unread_count` part gives the result a custom name (it appears as `$conversation->unread_count`). The closure adds WHERE conditions: only count messages where the receiver is the current user AND `is_read` is false.

   This is **one extra SQL subquery** — much faster than loading all messages and counting them in PHP.

   #### `'unread' => $conversation->unread_count`
   We replace the hardcoded `0` with the actual count from the database. If the user has 3 unread messages in this conversation, the frontend will now receive `unread: 3` and display the red badge.

   > **What about the `unread_count` property — where does it come from?**
   > Eloquent dynamically adds it as an attribute when you use `withCount()`. It's not a real column on the `conversations` table — it's a computed value from the SQL query. The name comes from what you put after `as` (in our case, `unread_count`).

---

## Step 6: Update the Frontend to Mark Messages as Read

**What is this?**
When a user clicks on a conversation, the frontend currently only fetches messages. Now we also need to: (1) send a request to mark messages as read, and (2) update the local unread count to 0 so the badge disappears immediately without waiting for a page reload.

1. Open `resources/js/pages/Home.tsx` and find the state declaration for conversations. We need to make it mutable so we can update unread counts locally. Add a new state variable right after `loadingMessages`:

   ```tsx
   // ... (leave existing state as-is) ...

   // tracks whether messages are currently being loaded from the server
   const [loadingMessages, setLoadingMessages] = useState(false);

   // ======== LOCAL CONVERSATIONS STATE ==========  ← ADD THIS
   // mutable copy of conversations so we can update unread counts without page reload
   const [localConversations, setLocalConversations] = useState(conversations);
   ```

2. Update the `filteredConversations` to use `localConversations` instead of `conversations`. Find the line:

   ```tsx
   const filteredConversations = conversations.filter((convo) =>
       convo.name.toLowerCase().includes(searchQuery.toLowerCase()),
   );
   ```

   And change it to:

   ```tsx
   const filteredConversations = localConversations.filter((convo) =>  // ← CHANGE: conversations → localConversations
       convo.name.toLowerCase().includes(searchQuery.toLowerCase()),
   );
   ```

3. Now update the `selectConversation` function to also mark messages as read and clear the badge. Find the existing function and update it:

   ```tsx
   // ========  SELECT CONVERSATION ==========
   // when the conversation is clicked, set it as an active and fetch its message from backend
   const selectConversation = async (convo: Conversation) => {
       setActiveConvo(convo); // highlights the conversation you clicked on the leftsidebar
       setLoadingMessages(true); // turns on the loading indicator
       // deletes the messages from the previous convo you were looking, so you dont see them while the new ones are loading
       setChatMessages([]);

       try {
           // fetch - reach out to laravel backend, it called ajax requestsm it req to our new route
           const response = await fetch(`/conversations/${convo.id}/messages`);
           // take the raw json and transform it into js array/object that react can understand
           const data = await response.json();
           // takes that fresh translated data and saves it into react memory
           setChatMessages(data);

           // ======== MARK MESSAGES AS READ ========== ← ADD THIS BLOCK
           // if this conversation has unread messages, tell the backend to mark them as read
           if (convo.unread > 0) {
               // get the CSRF token from the cookie (same pattern used elsewhere in this file)
               const csrfToken = document.querySelector<HTMLMetaElement>(
                   'meta[name="csrf-token"]',
               )?.content || '';

               // fire-and-forget: we don't need to wait for the response
               fetch(`/conversations/${convo.id}/mark-read`, {
                   method: 'POST',
                   headers: {
                       'Content-Type': 'application/json',
                       'X-CSRF-TOKEN': csrfToken,
                   },
               });

               // immediately update the local unread count to 0 so the badge disappears
               setLocalConversations((prev) =>
                   prev.map((c) =>
                       c.id === convo.id ? { ...c, unread: 0 } : c,
                   ),
               );
           }
           // ======== END MARK MESSAGES AS READ ==========
       } catch (error) {
           console.error('Failed to fetch messages:', error);
       } finally {
           setLoadingMessages(false);
       }
   };
   ```

   **Let's break down every part of this:**

   #### `if (convo.unread > 0)`
   We only send the mark-read request if there are actually unread messages. No point hitting the backend for a conversation that's already fully read.

   #### Fire-and-forget `fetch(...)`
   Notice we don't `await` this fetch call. We don't need the response — the mark-read request can complete in the background. The user sees the conversation instantly; the read-marking happens asynchronously. This is called a "fire-and-forget" pattern.

   #### `setLocalConversations((prev) => prev.map(...))`
   We optimistically update the UI — we set `unread: 0` immediately without waiting for the backend to confirm. This makes the badge disappear instantly. If the backend request fails, the next page load will show the correct count (self-correcting).

   > **Why use `localConversations` instead of modifying `conversations` directly?**
   > The `conversations` prop comes from Inertia (server-rendered data). React props are read-only — you can't modify them. So we create a local copy with `useState(conversations)` that we CAN modify. When we set `unread: 0`, only the local copy changes. On the next full page load, Inertia sends fresh data from the server.

---

## Step 7: Listen for the `MessagesRead` Broadcast Event

**What is this?**
When the receiver opens your conversation and marks your messages as read, we broadcast a `MessagesRead` event. The sender's browser should listen for this event. For now, we'll just log it to the console — in a future feature, you could use this to show ✓✓ checkmarks on sent messages.

1. Open `resources/js/pages/Home.tsx` and find the `useEffect` that sets up the real-time message listener (the one with `window.Echo.private(...)` that listens for `MessageSent`). Add the `MessagesRead` listener right after the `MessageSent` listener, inside the same `useEffect`:

   ```tsx
   // ========== REAL-TIME MESSAGE LISTENER ==========
   useEffect(() => {
       if (!activeConvo) {
           return;
       }

       // Subscribe to the private channel for this conversation
       const channel = window.Echo.private(`conversation.${activeConvo.id}`);

       // listen for new messages (already exists)
       channel.listen('.MessageSent', (event: Message) => {
           setChatMessages((prev) => [...prev, event]);
       });

       // ======== LISTEN FOR READ RECEIPTS ========== ← ADD THIS
       // when the other user reads our messages, log it (future: show ✓✓ checkmarks)
       channel.listen('.MessagesRead', (event: { conversation_id: number; read_by_user_id: number }) => {
           console.log(`Messages in conversation ${event.conversation_id} were read by user ${event.read_by_user_id}`);
           // future enhancement: update message bubbles to show ✓✓ read receipts
       });
       // ======== END LISTEN FOR READ RECEIPTS ==========

       // ... (leave existing cleanup/whisper code as-is) ...
   ```

   **Let's break down every part of this:**

   #### `.listen('.MessagesRead', ...)`
   The dot prefix (`.MessagesRead`) tells Echo to use the event's class name directly. This matches the `App\Events\MessagesRead` event we created in Step 2. Without the dot, Echo would prepend the default event namespace.

   #### The event payload
   The callback receives the data from `broadcastWith()` — the `conversation_id` and `read_by_user_id`. For now we log it, but this is where you'd later add logic to show double-checkmarks (✓✓) on messages.

   > **Do I need to add a cleanup for this listener?**
   > No. The existing cleanup already calls `window.Echo.leave(...)` which removes ALL listeners on the channel — including our new `MessagesRead` listener. One `leave()` handles everything.

---

## Step 8: Update Unread Count When a New Message Arrives

**What is this?**
There's one more scenario to handle: when you're NOT looking at a conversation and a new message arrives, the unread badge should increment. Right now the real-time listener adds the message to the chat, but if the message arrives for a conversation you're NOT currently viewing, the sidebar badge should update.

1. Open `resources/js/pages/Home.tsx` and find the `useEffect` that listens to `MessageSent` events. We need to also update `localConversations` when a new message arrives. Look for the `.listen('.MessageSent', ...)` block and update the handler:

   ```tsx
   // listen for new messages
   channel.listen('.MessageSent', (event: Message) => {
       setChatMessages((prev) => [...prev, event]);

       // ======== UPDATE SIDEBAR PREVIEW ========== ← ADD THIS
       // update the last message preview and bump unread count for this conversation
       setLocalConversations((prev) =>
           prev.map((c) => {
               if (c.id === activeConvo.id) {
                   return {
                       ...c,
                       lastMessage: event.content,
                       time: event.time,
                       // don't increment unread — the user is already looking at this conversation
                   };
               }
               return c;
           }),
       );
       // ======== END UPDATE SIDEBAR PREVIEW ==========
   });
   ```

   > **What about messages in conversations we're NOT viewing?**
   > For conversations the user isn't currently subscribed to (not `activeConvo`), the unread count won't update in real time — it will be correct on the next page load. To handle cross-conversation real-time updates, you'd need a user-level notification channel, which is a more advanced pattern covered in later features.

---

## Step 9: Test It Manually

Here's how to verify everything works end-to-end:

1. Make sure your development environment is running:
   ```bash
   composer dev
   ```
   This starts the Laravel server, Vite dev server, and Reverb WebSocket server.

2. Make sure your queue worker is running in a separate terminal:
   ```bash
   php artisan queue:work
   ```

3. Open **two browser windows** (or one regular + one incognito). Log in as two different users (e.g., User A and User B).

4. **As User A**, send 3 messages to User B in a conversation.

5. **As User B**, look at the sidebar — you should see a red badge with "3" on that conversation.

6. **As User B**, click on the conversation — the badge should disappear immediately.

7. **Check the queue worker terminal** — you should see a log line showing `MarkMessagesRead` was processed.

8. **Check your database** — all 3 messages should now have `is_read = true`:
   ```bash
   php artisan tinker
   ```
   ```php
   App\Models\Message::where('conversation_id', 1)->pluck('is_read');
   // Should show: [true, true, true]
   ```

9. **Check User A's browser console** (DevTools → Console) — you should see a log message like:
   ```
   Messages in conversation 1 were read by user 2
   ```

**Common issues:**

- **Badge doesn't show up** — Make sure you updated `ConversationController@index` to use `withCount` instead of the hardcoded `0`. Refresh the page to get fresh server data.
- **Badge doesn't disappear when clicking** — Check that `filteredConversations` uses `localConversations` (not `conversations`). The local state update is what makes the badge vanish instantly.
- **Queue job not processing** — Make sure `php artisan queue:work` is running AND your `.env` has `QUEUE_CONNECTION=database` (not `sync`). If using `sync`, the job runs inline — still works but defeats the purpose.
- **MessagesRead event not received** — Open DevTools → Network → WS tab and look for the WebSocket frames. The event should appear as a JSON payload on the `conversation.X` channel.

---

## Step 10: Write Automated Tests

**Why do we need this?**
We need to verify three things: (1) the mark-read endpoint works, (2) the job actually updates the database, and (3) the unread count in the conversation list is correct. These tests catch regressions if someone changes the message or conversation code later.

1. Create a new test file at `tests/Feature/MarkMessagesReadTest.php`:

   ```php
   <?php

   use App\Jobs\MarkMessagesRead;
   use App\Models\Conversation;
   use App\Models\Message;
   use App\Models\User;
   use Illuminate\Foundation\Testing\RefreshDatabase;
   use Illuminate\Support\Facades\Queue;
   use Tests\TestCase;

   uses(RefreshDatabase::class);

   test('opening a conversation dispatches the mark messages read job', function () {
       // 1. ARRANGE: fake the queue so jobs don't actually run
       // Queue::fake() intercepts all dispatched jobs and stores them in memory
       // this lets us assert "was this job dispatched?" without running it
       Queue::fake();

       /** @var User $sender */
       $sender = User::factory()->create();

       /** @var User $receiver */
       $receiver = User::factory()->create();

       $conversation = Conversation::create();
       $conversation->users()->attach([$sender->id, $receiver->id]);

       // create unread messages from sender to receiver
       Message::create([
           'conversation_id' => $conversation->id,
           'sender_id' => $sender->id,
           'receiver_id' => $receiver->id,
           'body' => 'Hello!',
           'is_read' => false,
       ]);

       // 2. ACT: the receiver hits the mark-read endpoint
       /** @var TestCase $this */
       $response = $this->actingAs($receiver)->postJson(
           route('conversations.mark-read', $conversation)
       );

       // 3. ASSERT: the endpoint returns success and the job was dispatched
       $response->assertOk();

       // verify the job was pushed to the queue with the correct data
       Queue::assertPushed(MarkMessagesRead::class, function ($job) use ($conversation, $receiver) {
           return $job->conversationId === $conversation->id
               && $job->userId === $receiver->id;
       });
   });

   test('mark messages read job updates unread messages to read', function () {
       // 1. ARRANGE: create a conversation with unread messages
       /** @var User $sender */
       $sender = User::factory()->create();

       /** @var User $receiver */
       $receiver = User::factory()->create();

       $conversation = Conversation::create();
       $conversation->users()->attach([$sender->id, $receiver->id]);

       // create 3 unread messages
       foreach (['Hey!', 'Are you there?', 'Hello??'] as $body) {
           Message::create([
               'conversation_id' => $conversation->id,
               'sender_id' => $sender->id,
               'receiver_id' => $receiver->id,
               'body' => $body,
               'is_read' => false,
           ]);
       }

       // 2. ACT: run the job directly (not through the queue)
       // we instantiate and call handle() to test the job's logic in isolation
       $job = new MarkMessagesRead($conversation->id, $receiver->id);
       $job->handle();

       // 3. ASSERT: all 3 messages should now be read
       /** @var TestCase $this */
       $this->assertDatabaseCount('messages', 3);

       // verify every message in this conversation is now marked as read
       $unreadCount = Message::where('conversation_id', $conversation->id)
           ->where('is_read', false)
           ->count();

       expect($unreadCount)->toBe(0);
   });

   test('mark messages read does not affect messages sent by the reader', function () {
       // 1. ARRANGE: create messages in both directions
       /** @var User $userA */
       $userA = User::factory()->create();

       /** @var User $userB */
       $userB = User::factory()->create();

       $conversation = Conversation::create();
       $conversation->users()->attach([$userA->id, $userB->id]);

       // message from A to B (B is the receiver)
       Message::create([
           'conversation_id' => $conversation->id,
           'sender_id' => $userA->id,
           'receiver_id' => $userB->id,
           'body' => 'From A to B',
           'is_read' => false,
       ]);

       // message from B to A (A is the receiver)
       Message::create([
           'conversation_id' => $conversation->id,
           'sender_id' => $userB->id,
           'receiver_id' => $userA->id,
           'body' => 'From B to A',
           'is_read' => false,
       ]);

       // 2. ACT: User B marks messages as read
       // this should only mark messages where B is the RECEIVER
       $job = new MarkMessagesRead($conversation->id, $userB->id);
       $job->handle();

       // 3. ASSERT: only the message sent TO User B should be marked as read
       /** @var TestCase $this */
       $this->assertDatabaseHas('messages', [
           'body' => 'From A to B',
           'receiver_id' => $userB->id,
           'is_read' => true,  // ← this one should be read (B is the receiver)
       ]);

       $this->assertDatabaseHas('messages', [
           'body' => 'From B to A',
           'receiver_id' => $userA->id,
           'is_read' => false,  // ← this one should still be unread (A is the receiver, not B)
       ]);
   });

   test('user cannot mark messages as read in a conversation they do not belong to', function () {
       // 1. ARRANGE: create a conversation the outsider is NOT part of
       /** @var User $outsider */
       $outsider = User::factory()->create();

       /** @var User $userA */
       $userA = User::factory()->create();

       /** @var User $userB */
       $userB = User::factory()->create();

       $conversation = Conversation::create();
       $conversation->users()->attach([$userA->id, $userB->id]);

       // 2. ACT: outsider tries to mark messages as read
       /** @var TestCase $this */
       $response = $this->actingAs($outsider)->postJson(
           route('conversations.mark-read', $conversation)
       );

       // 3. ASSERT: should be forbidden
       $response->assertForbidden();
   });

   test('conversation list shows correct unread count', function () {
       // 1. ARRANGE: create a conversation with 2 unread messages
       /** @var User $sender */
       $sender = User::factory()->create();

       /** @var User $receiver */
       $receiver = User::factory()->create();

       $conversation = Conversation::create();
       $conversation->users()->attach([$sender->id, $receiver->id]);

       // create 2 unread messages
       Message::create([
           'conversation_id' => $conversation->id,
           'sender_id' => $sender->id,
           'receiver_id' => $receiver->id,
           'body' => 'First unread',
           'is_read' => false,
       ]);

       Message::create([
           'conversation_id' => $conversation->id,
           'sender_id' => $sender->id,
           'receiver_id' => $receiver->id,
           'body' => 'Second unread',
           'is_read' => false,
       ]);

       // create 1 already-read message
       Message::create([
           'conversation_id' => $conversation->id,
           'sender_id' => $sender->id,
           'receiver_id' => $receiver->id,
           'body' => 'Already read',
           'is_read' => true,
       ]);

       // 2. ACT: load the dashboard as the receiver
       /** @var TestCase $this */
       $response = $this->actingAs($receiver)->get(route('dashboard'));

       // 3. ASSERT: the conversation should show unread count of 2 (not 3)
       $response->assertOk();
       $response->assertInertia(function ($page) {
           $conversations = $page->toArray()['props']['conversations'];
           // the first conversation should have unread = 2
           expect($conversations[0]['unread'])->toBe(2);
       });
   });
   ```

2. Run the tests:
   ```bash
   php artisan test --filter=MarkMessagesReadTest
   ```

   You should see all 5 tests pass:
   ```
   PASS  Tests\Feature\MarkMessagesReadTest
   ✓ opening a conversation dispatches the mark messages read job
   ✓ mark messages read job updates unread messages to read
   ✓ mark messages read does not affect messages sent by the reader
   ✓ user cannot mark messages as read in a conversation they do not belong to
   ✓ conversation list shows correct unread count
   ```

---

## ✅ Mark Messages as Read Checklist

- [ ] Created `MarkMessagesRead` job (`app/Jobs/MarkMessagesRead.php`)
- [ ] Created `MessagesRead` broadcast event (`app/Events/MessagesRead.php`)
- [ ] Added `markAsRead` method to `MessageController`
- [ ] Added `POST conversations/{conversation}/mark-read` route
- [ ] Updated `ConversationController@index` to use `withCount` for real unread counts
- [ ] Added `localConversations` state to `Home.tsx` for mutable sidebar data
- [ ] Updated `selectConversation` to call mark-read endpoint and clear badge
- [ ] Updated `filteredConversations` to use `localConversations`
- [ ] Added `MessagesRead` event listener in the WebSocket `useEffect`
- [ ] Updated sidebar `lastMessage` preview on real-time message arrival
- [ ] Written 5 Pest tests covering job, controller, authorization, and unread count
- [ ] All tests passing

---

## 🔮 What's Next? (File & Image Attachments Preview)

Now that messages can be marked as read and the sidebar reflects real unread counts, the messaging system is functionally complete for text. In **Feature 4.3 — File & Image Attachments**, we'll let users send images and files in the chat. This will introduce another queued job concept — `ProcessAttachment` — which compresses and resizes images in the background. You'll reuse the same queue patterns you learned here (create a job, dispatch it, let the worker handle the heavy lifting).

---

> **Tip:** If your queue worker isn't processing jobs, check `php artisan queue:failed` to see if any jobs failed. You can retry them with `php artisan queue:retry all`. Also, during development, you can set `QUEUE_CONNECTION=sync` in your `.env` to make jobs run immediately (no worker needed) — useful for debugging, but switch back to `database` before testing queue-specific behavior.
