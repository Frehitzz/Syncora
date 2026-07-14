# Phase 2 — Feature 2.2: Load Real Messages in the Chat Window

In Feature 2.1, we made the **left sidebar** real — it now shows actual conversations from the database. But the **right side** (the chat window) still shows fake, hardcoded messages from "Alice Nguyen."

In this tutorial, we will make the chat window real. When you click on a conversation in the sidebar, the right side will load and display the actual messages from the database for that conversation.

---

## What We Are Building

Right now in `Home.tsx`, there is a hardcoded array called `const messages = [...]` (lines 18–26). We are going to:

1. Create a `MessageController` that fetches real messages from the database.
2. Add a new route so the frontend can request messages for a specific conversation.
3. Update `Home.tsx` to track which conversation is selected, fetch its messages, and display them.
4. Write a Pest test to verify everything works.

---

## Step-by-Step Implementation

### Step 1: Create the `MessageController`

We need a new controller dedicated to handling messages. In Feature 2.1, we created `ConversationController` for conversations — now we create `MessageController` for messages.

**Why a separate controller?**
In Laravel, the best practice is to have one controller per "resource" (a thing in your app). Conversations and messages are two different resources. Keeping them in separate controllers makes your code organized and easy to find.

1. In your terminal, run the command:
   ```bash
   php artisan make:controller MessageController
   ```

2. Open the newly created `app/Http/Controllers/MessageController.php` file.

3. Replace its contents with the code below:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class MessageController extends Controller
{
    // ========== show ===========
    // Fetch and return all messages for a specific conversation
    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        // Make sure the logged-in user actually belongs to this conversation
        if (!$conversation->users()->where('user_id', $user->id)->exists()) {
            abort(403, 'You do not belong to this conversation.');
        }

        // Fetch messages for this conversation, ordered from oldest to newest
        $messages = $conversation->messages()
            ->with('sender:id,name')
            ->oldest()
            ->get()
            ->map(function ($message) use ($user) {
                return [
                    'id'      => $message->id,
                    'sender'  => $message->sender->name,
                    'content' => $message->body,
                    'time'    => $message->created_at->format('g:i A'),
                    'isOwn'   => $message->sender_id === $user->id,
                ];
            });

        return response()->json($messages);
    }
}
```

**Let's break this code down piece by piece:**

#### `public function show(Request $request, Conversation $conversation): JsonResponse`
- **Why `show`?** In Laravel naming conventions, `show` means "show me the details of one specific thing." We are showing the messages of one specific conversation.
- **Why `Conversation $conversation`?** This is called **Route Model Binding**. When the URL contains a conversation ID (like `/conversations/5/messages`), Laravel automatically goes to the database, finds the conversation with `id = 5`, and hands it to you as a full `$conversation` object. You don't have to write `Conversation::find($id)` yourself!
- **Why `JsonResponse` instead of `Inertia\Response`?** In Feature 2.1, we returned an Inertia response because we were loading a full page. But here, we are NOT loading a new page — we are staying on the same page and just fetching data in the background when the user clicks a conversation. This is called an **AJAX request**, and for AJAX we return JSON (raw data) instead of a full page.

#### The Authorization Check
```php
if (!$conversation->users()->where('user_id', $user->id)->exists()) {
    abort(403, 'You do not belong to this conversation.');
}
```
- **Why do we need this?** Imagine a hacker who knows conversation ID #7 exists. Without this check, they could type `/conversations/7/messages` in their browser and read someone else's private messages! This code says: "Before I give you any messages, let me verify that you actually belong to this conversation." If they don't, we send back a `403 Forbidden` error.

#### Fetching and Formatting Messages
```php
$messages = $conversation->messages()
    ->with('sender:id,name')
    ->oldest()
    ->get()
    ->map(function ($message) use ($user) { ... });
```
- **`->with('sender:id,name')`**: This is eager loading (just like Feature 2.1!), but with a twist. The `:id,name` part tells Laravel: "Only fetch the `id` and `name` columns from the `users` table." We don't need the sender's email, password, etc. This makes the query faster.
- **`->oldest()`**: This sorts messages from oldest to newest (like a real chat — oldest messages at the top, newest at the bottom).
- **`->map(...)`**: Just like in Feature 2.1, we transform the raw database data into the exact format that React expects. We create keys like `sender`, `content`, `time`, and `isOwn`.
- **`'isOwn' => $message->sender_id === $user->id`**: This is a true/false check. If the person who sent the message is the same as the currently logged-in user, then `isOwn` is `true`. React uses this to decide whether to put the message bubble on the right (your messages) or the left (their messages).

> [!NOTE]
> We used `/** @var \App\Models\User $user */` above `$request->user()` to tell PHPStan the exact type, just like we learned in Feature 2.1.

---

### Step 2: Add the Route

We need to tell Laravel: "When someone visits `/conversations/{id}/messages`, send them to the `MessageController`."

1. Open `routes/web.php`.
2. Import the `MessageController` at the top (below the existing `ConversationController` import):
   ```php
   use App\Http\Controllers\MessageController;
   ```
3. Add a new route inside the `auth` middleware group. Your full route group should now look like this:
   ```php
   Route::middleware(['auth', 'verified'])->group(function () {
       Route::get('dashboard', [ConversationController::class, 'index'])->name('dashboard');
       Route::get('conversations/{conversation}/messages', [MessageController::class, 'show'])->name('conversations.messages');
   });
   ```

**Why this URL pattern?**
- The URL `conversations/{conversation}/messages` follows a standard called **RESTful routing**. It reads like plain English: "Give me the messages of this conversation."
- `{conversation}` is a placeholder. When someone visits `conversations/5/messages`, Laravel replaces `{conversation}` with `5` and uses Route Model Binding to automatically find the conversation with ID 5.
- We give it the name `conversations.messages` so we can refer to it later using `route('conversations.messages', $conversation)` instead of typing the full URL.

---

### Step 3: Add State Tracking in `Home.tsx`

Right now, the sidebar just highlights the first conversation. We need to make it interactive — when you click a conversation, it should:
1. Become the "active" conversation (highlighted in the sidebar).
2. Fetch that conversation's real messages from the backend.
3. Display those messages in the chat window.

#### Sub-step 3.1: Add the `Message` interface

Just like we created a `Conversation` interface in Feature 2.1, we need a `Message` interface so TypeScript knows the shape of a message.

1. Open `resources/js/pages/Home.tsx`.
2. Right below the existing `Conversation` interface (after line 16), add a new interface:
   ```typescript
   interface Message {
       id: number;
       sender: string;
       content: string;
       time: string;
       isOwn: boolean;
   }
   ```

**Why do we need this?**
Remember: an interface is a "strict contract blueprint." Without it, TypeScript has no idea what fields a message has. With it, you get autocomplete and error prevention.

#### Sub-step 3.2: Delete the hardcoded messages array

1. Find and **delete** the entire `const messages = [...]` array (the fake Alice Nguyen messages, currently around lines 18–26).

**Why?** We are about to fetch real messages from the database. Keeping the fake data around would confuse things.

#### Sub-step 3.3: Add React state for active conversation and messages

Inside the `Home` function component, we need to add "state" — React's way of remembering things that can change over time.

1. First, add the `useState` and `useEffect` imports. Update the very first line of `Home.tsx`:
   ```typescript
   import { Head, Link } from '@inertiajs/react';
   ```
   Change it to:
   ```typescript
   import { useState, useEffect } from 'react';
   import { Head, Link } from '@inertiajs/react';
   ```

2. Inside the `Home` component function, replace the old `activeConvo` line:
   ```typescript
   const activeConvo = conversations[0] || null;
   ```
   With these new lines:
   ```typescript
   const [activeConvo, setActiveConvo] = useState<Conversation | null>(conversations[0] || null);
   const [chatMessages, setChatMessages] = useState<Message[]>([]);
   const [loadingMessages, setLoadingMessages] = useState(false);
   ```

**Let's break this down:**
- **`useState<Conversation | null>(conversations[0] || null)`**: This creates a "memory slot" called `activeConvo`. React will remember which conversation is currently selected. `setActiveConvo` is the function we call to change it. The initial value is the first conversation (or `null` if there are none).
- **`useState<Message[]>([])`**: This creates a memory slot for the chat messages. It starts as an empty array `[]` because we haven't loaded any messages yet.
- **`useState(false)`**: This tracks whether messages are currently being loaded from the server. We use this to show a "Loading..." text while we wait.

#### Sub-step 3.4: Add the function to fetch messages

Right after the state declarations (and after the `toggleTheme` function), add this function:

```typescript
// ========== selectConversation ===========
// When a conversation is clicked, set it as active and fetch its messages from the backend
const selectConversation = async (convo: Conversation) => {
    setActiveConvo(convo);
    setLoadingMessages(true);
    setChatMessages([]);

    try {
        const response = await fetch(`/conversations/${convo.id}/messages`);
        const data = await response.json();
        setChatMessages(data);
    } catch (error) {
        console.error('Failed to fetch messages:', error);
    } finally {
        setLoadingMessages(false);
    }
};
```

**Let's break this down:**
- **`async`**: This keyword tells JavaScript: "This function will do something that takes time (like talking to the server). Don't freeze the entire page while waiting."
- **`setActiveConvo(convo)`**: Immediately highlights the clicked conversation in the sidebar.
- **`setLoadingMessages(true)`**: Turns on the loading indicator.
- **`setChatMessages([])`**: Clears old messages so you don't see the previous conversation's messages for a split second.
- **`fetch('/conversations/${convo.id}/messages')`**: This is the AJAX request! It sends a request to our new route and waits for the server to respond with the messages as JSON.
- **`setChatMessages(data)`**: Once the server responds, we store the real messages into React's memory.
- **`finally`**: This block always runs, whether the fetch succeeded or failed. We use it to turn off the loading indicator.

#### Sub-step 3.5: Auto-load messages for the first conversation

When the page first loads and there are conversations, we want to automatically load the messages for the first one. Add this `useEffect` right after the `selectConversation` function:

```typescript
// Auto-load messages for the first conversation when the page loads
useEffect(() => {
    if (conversations.length > 0) {
        selectConversation(conversations[0]);
    }
}, []);
```

**Why `useEffect`?**
- `useEffect` is React's way of saying: "Run this code once when the component first appears on screen." Without it, we would have no messages loaded when the page opens.
- The `[]` at the end means "only run this once, when the page first loads." If we left it out, it would run on every re-render and cause an infinite loop!

#### Sub-step 3.6: Make the conversation list clickable

Find the `ConversationItem` component in the conversation list rendering section (around line 193). It currently looks like this:

```tsx
{conversations.map((convo) => (
    <ConversationItem
        key={convo.id}
        convo={convo}
        active={convo.id === activeConvo.id}
    />
))}
```

Update it to add the click handler and use safe null checking:

```tsx
{conversations.map((convo) => (
    <div key={convo.id} onClick={() => selectConversation(convo)}>
        <ConversationItem
            convo={convo}
            active={activeConvo !== null && convo.id === activeConvo.id}
        />
    </div>
))}
```

**What changed?**
- We wrapped each `ConversationItem` in a `<div>` with an `onClick`. Now when you click a conversation, it calls `selectConversation(convo)`, which loads its messages.
- We changed `convo.id === activeConvo.id` to `activeConvo !== null && convo.id === activeConvo.id`. This prevents a crash when `activeConvo` is `null` (no conversations exist).
- We removed the `key` from `ConversationItem` and put it on the wrapping `<div>` instead, because React needs the `key` on the outermost element.

#### Sub-step 3.7: Update the `MessageBubble` component type

The `MessageBubble` component currently uses `typeof messages[0]` for its type — but we just deleted the fake `messages` array! Update the component signature.

Find:
```typescript
function MessageBubble({ message }: { message: typeof messages[0] }) {
```

Replace with:
```typescript
function MessageBubble({ message }: { message: Message }) {
```

**Why?** Same reason we fixed `ConversationItem` in Feature 2.1. The old type reference pointed to the deleted array. We now use the `Message` interface we defined in Sub-step 3.1.

#### Sub-step 3.8: Update the messages area to use real data

Find the Messages Area section in your JSX (around line 247). It currently looks like this:

```tsx
{/* Messages Area */}
<div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
    {/* Date Separator */}
    <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-sans flex-shrink-0">Today</span>
        <div className="flex-1 h-px bg-border" />
    </div>

    {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
    ))}
</div>
```

Replace the entire Messages Area block with:

```tsx
{/* Messages Area */}
<div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
    {activeConvo ? (
        <>
            {/* Date Separator */}
            <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-sans flex-shrink-0">Today</span>
                <div className="flex-1 h-px bg-border" />
            </div>

            {loadingMessages ? (
                <p className="text-center text-sm text-muted-foreground font-sans py-8">Loading messages...</p>
            ) : chatMessages.length > 0 ? (
                chatMessages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                ))
            ) : (
                <p className="text-center text-sm text-muted-foreground font-sans py-8">No messages yet. Say hello! 👋</p>
            )}
        </>
    ) : (
        <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground font-sans">Select a conversation to view messages</p>
        </div>
    )}
</div>
```

**What is happening here?**
- **`activeConvo ?`**: If a conversation is selected, show the messages. If not, show "Select a conversation."
- **`loadingMessages ?`**: While messages are being fetched from the server, show "Loading messages..."
- **`chatMessages.length > 0 ?`**: If there are messages, render them. If the conversation has zero messages, show "No messages yet. Say hello! 👋"
- **`chatMessages.map(...)`**: This loops through the real messages (fetched from the database!) and renders a `MessageBubble` for each one.

#### Sub-step 3.9: Wrap the message input in a condition

The message input box at the bottom should only appear when a conversation is selected. Find the `{/* Message Input */}` section (around line 260) and wrap it:

Find the entire Message Input `div`:
```tsx
{/* Message Input */}
<div className="flex-shrink-0 px-6 py-4 border-t border-border bg-background">
    ...entire input section...
</div>
```

Wrap it with a condition:
```tsx
{/* Message Input */}
{activeConvo && (
    <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-background">
        ...entire input section stays exactly the same...
    </div>
)}
```

**Why?** If no conversation is selected, there is nothing to type into. Hiding the input makes the UI cleaner.

---

### Step 4: Write the Controller Test

1. In your terminal, run the command to create the test file:
   ```bash
   php artisan pest:test MessageControllerTest
   ```

2. Open `tests/Feature/MessageControllerTest.php` and replace its contents with:

```php
<?php

use App\Models\User;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('logged in user can view messages for their conversation', function () {
    // 1. ARRANGE: Create 2 users, a conversation, and a message
    /** @var User $user */
    $user = User::factory()->create();

    /** @var User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    Message::create([
        'conversation_id' => $conversation->id,
        'sender_id'       => $otherUser->id,
        'receiver_id'     => $user->id,
        'body'            => 'Hey, how are you?',
        'is_read'         => false,
    ]);

    // 2. ACT: Request the messages for this conversation
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->getJson(
        route('conversations.messages', $conversation)
    );

    // 3. ASSERT: The response contains the correct message data
    $response->assertOk();
    $response->assertJsonCount(1);
    $response->assertJsonFragment([
        'sender'  => $otherUser->name,
        'content' => 'Hey, how are you?',
        'isOwn'   => false,
    ]);
});

test('user cannot view messages for a conversation they do not belong to', function () {
    // 1. ARRANGE: Create a conversation that the user is NOT part of
    /** @var User $user */
    $user = User::factory()->create();

    /** @var User $stranger1 */
    $stranger1 = User::factory()->create();

    /** @var User $stranger2 */
    $stranger2 = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$stranger1->id, $stranger2->id]);

    // 2. ACT: Try to access the strangers' conversation
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->getJson(
        route('conversations.messages', $conversation)
    );

    // 3. ASSERT: Access is denied
    $response->assertForbidden();
});
```

**Let's break down the tests:**

#### Test 1: "logged in user can view messages for their conversation"
- **ARRANGE:** We create two users, put them in a conversation, and add one message from `$otherUser` to `$user`.
- **ACT:** We log in as `$user` and send a GET request to our new messages route.
- **ASSERT:** We check three things:
  - `assertOk()` — The server responded with status 200 (success).
  - `assertJsonCount(1)` — Exactly 1 message was returned.
  - `assertJsonFragment(...)` — The response contains the sender's name, the message text, and `isOwn` is `false` (because the other user sent it, not us).

**Why `getJson` instead of `get`?**
Since our controller returns JSON (not an Inertia page), we use `getJson()` which automatically sets the request header to expect a JSON response.

#### Test 2: "user cannot view messages for a conversation they do not belong to"
- This test verifies the security check we wrote in the controller. A user who is NOT part of a conversation should get a `403 Forbidden` error.
- **Why do we test this?** Because security is not something you can "just assume works." If someone accidentally removes the authorization check during a future code change, this test will immediately fail and alert you.

---

## Verification

To verify that your code works and passes all checks:

1. Run the specific test file:
   ```bash
   php artisan test tests/Feature/MessageControllerTest.php
   ```

2. Run the full test suite (to make sure you didn't break anything):
   ```bash
   php artisan test
   ```

3. Run the type checker:
   ```bash
   composer types:check
   ```

4. Open your browser, log in, and click different conversations in the sidebar. If any conversations have messages in the database, you should see real messages appear in the chat window!

> [!TIP]
> If you don't have any messages in the database yet, don't worry — the chat window will just show "No messages yet. Say hello! 👋". In Feature 2.3 (next tutorial), we will make the send button work so you can actually send messages!
