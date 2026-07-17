# Phase 2 — Feature 2.3: Send a Message

In Feature 2.2, we made the **chat window** real — when you click a conversation in the sidebar, it fetches and displays the actual messages from the database. But the **input box** at the bottom of the chat window is useless right now. You can type into it, but pressing the send button does nothing.

In this tutorial, we will make the send button actually work. When you type a message and press send, it will save to the database and instantly appear in the chat window.

---

## What We Are Building

Right now in `Home.tsx`, there is an `<input>` field and a send `<button>` at the bottom of the chat window (lines 322–334). They look nice but they don't do anything. We are going to:

1. Create a `store` method in `MessageController` that receives the message text and saves it to the database.
2. Add a new POST route so the frontend can send messages to the backend.
3. Validate the message input on the backend (make sure it's not empty, make sure the user belongs to the conversation).
4. Update `Home.tsx` so that when you type a message and press send (or hit Enter), it sends the message to the backend and shows it in the chat window.
5. Write a Pest test to verify everything works.

---

## Step-by-Step Implementation

### Step 1: Add the `store` Method in `MessageController`

We already have a `MessageController` from Feature 2.2 with a `show` method that fetches messages. Now we need to add a `store` method that **saves** a new message.

**Why is it called `store`?**
In Laravel, there are naming conventions for controller methods. The most common ones are:
- `index` — list many things
- `show` — show one thing
- `store` — save a new thing
- `update` — change an existing thing
- `destroy` — delete a thing

Since we are saving a new message, we use the name `store`.

1. Open `app/Http/Controllers/MessageController.php`.

2. First, add the `Message` model import at the top of the file. You need to add this below the existing imports:
   ```php
   use App\Models\Message;
   ```

3. Then add the `store` method below the existing `show` method (after its closing `}`):

```php
    // ====== store ========
    // validate, save, and return a new message for the conversation
    public function store(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        // make sure the logged-in user belongs to this conversation
        if (!$conversation->users()->where('user_id', $user->id)->exists()) {
            abort(403, 'You do not belong to this conversation.');
        }

        // validate: make sure the message is not empty
        $validated = $request->validate([
            'body' => 'required|string|max:5000',
        ]);

        // figure out who the other person in this conversation is
        $receiverId = $conversation->users()
            ->where('user_id', '!=', $user->id)
            ->value('user_id');

        // save the message to the database
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id'       => $user->id,
            'receiver_id'     => $receiverId,
            'body'            => $validated['body'],
            'is_read'         => false,
        ]);

        // return the new message in the same format the frontend expects
        return response()->json([
            'id'      => $message->id,
            'sender'  => $user->name,
            'content' => $message->body,
            'time'    => $message->created_at->format('g:i A'),
            'isOwn'   => true,
        ], 201);
    }
```

**Let's break this code down piece by piece:**

#### `public function store(Request $request, Conversation $conversation): JsonResponse`
- **Why `store`?** Because we are creating/saving something new (a message). Laravel convention says `store` = create a new thing.
- **Why `Request $request`?** The `$request` object carries everything the user sent to us — the message text, their login cookies, etc. We need it to read the message body and to know who is logged in.
- **Why `Conversation $conversation`?** Just like in the `show` method, this uses **Route Model Binding**. The URL will look like `/conversations/5/messages`, and Laravel will automatically find the conversation with `id = 5` and hand it to us.
- **Why `JsonResponse`?** Same reason as `show` — we are NOT loading a new page. We are sending data back to the frontend on the same page, so we use JSON.

#### The Authorization Check
```php
if (!$conversation->users()->where('user_id', $user->id)->exists()) {
    abort(403, 'You do not belong to this conversation.');
}
```
- **Why do we check this again?** This is the same security check from the `show` method. We need it here too because a hacker could try to send a POST request to a conversation they don't belong to. Without this check, anyone could inject messages into anyone else's conversation. Always verify on every endpoint!

#### Validation
```php
$validated = $request->validate([
    'body' => 'required|string|max:5000',
]);
```
- **What does this do?** It checks the data the user sent us before we save it. Think of it like a bouncer at a club checking your ID before letting you in.
- **`required`** — The message cannot be empty. You can't send a blank message.
- **`string`** — The message must be text. Not a number, not an array, just text.
- **`max:5000`** — The message can be at most 5,000 characters. This prevents someone from sending a message that's a million characters long and crashing our database.
- **What happens if validation fails?** Laravel automatically sends back a `422 Unprocessable Entity` error with details about what went wrong. We don't have to write any error handling code ourselves — Laravel does it for us.

#### Finding the Receiver
```php
$receiverId = $conversation->users()
    ->where('user_id', '!=', $user->id)
    ->value('user_id');
```
- **Why do we need a receiver?** Our `messages` table has a `receiver_id` column (you can see it in the migration). In a 1-on-1 chat, the receiver is the other person in the conversation.
- **How does this work?** We look at all users in this conversation and find the one whose ID is NOT the same as the logged-in user. That's the receiver.
- **`->value('user_id')`** — Instead of getting a full user object, we only get the `user_id` number. It's faster because we only need the ID, not the entire user record.

#### Saving the Message
```php
$message = Message::create([
    'conversation_id' => $conversation->id,
    'sender_id'       => $user->id,
    'receiver_id'     => $receiverId,
    'body'            => $validated['body'],
    'is_read'         => false,
]);
```
- **`Message::create([...])`** — This creates a new row in the `messages` table with these values. It's the same as writing a SQL `INSERT INTO messages (...)` query, but much cleaner.
- **Why `$validated['body']` instead of `$request->body`?** Because `$validated` contains only the data that passed our validation rules. It's the "cleaned" version. Using the validated data is a security best practice — it guarantees you're only saving data that met your rules.
- **Why `'is_read' => false`?** When you send a message, the other person hasn't seen it yet. So it starts as unread.

#### Returning the New Message
```php
return response()->json([
    'id'      => $message->id,
    'sender'  => $user->name,
    'content' => $message->body,
    'time'    => $message->created_at->format('g:i A'),
    'isOwn'   => true,
], 201);
```
- **Why do we return the message?** After saving the message to the database, we send it back to React so it can immediately display it in the chat window. If we didn't return it, React wouldn't know the message was saved and wouldn't show it on screen.
- **Why is `isOwn` always `true`?** Because the person calling this endpoint is always the sender. You are sending your own message, so it's always your own.
- **Why `201`?** HTTP status code `201` means "Created" — it tells the frontend that a new resource (the message) was successfully created. The `show` method returns `200` (OK) because it's just reading. `store` returns `201` because it created something new. It's a small detail but it's good practice.
- **Why the same format as `show`?** React already knows how to display messages in this format (with `id`, `sender`, `content`, `time`, `isOwn`). By returning the same format, we can simply add the new message to the existing list without any extra transformation.

Your complete `MessageController.php` should now look like this:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    // ====== show ========
    // fetch and return all messages for specific conversation
    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if (!$conversation->users()->where('user_id', $user->id)->exists()) {
            abort(403, 'You do not belong to this conversation.');
        }

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

    // ====== store ========
    // validate, save, and return a new message for the conversation
    public function store(Request $request, Conversation $conversation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        // make sure the logged-in user belongs to this conversation
        if (!$conversation->users()->where('user_id', $user->id)->exists()) {
            abort(403, 'You do not belong to this conversation.');
        }

        // validate: make sure the message is not empty
        $validated = $request->validate([
            'body' => 'required|string|max:5000',
        ]);

        // figure out who the other person in this conversation is
        $receiverId = $conversation->users()
            ->where('user_id', '!=', $user->id)
            ->value('user_id');

        // save the message to the database
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id'       => $user->id,
            'receiver_id'     => $receiverId,
            'body'            => $validated['body'],
            'is_read'         => false,
        ]);

        // return the new message in the same format the frontend expects
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

---

### Step 2: Add the POST Route

We need to tell Laravel: "When the frontend sends a POST request to `/conversations/{id}/messages`, run the `store` method in `MessageController`."

1. Open `routes/web.php`.

2. Add a new POST route inside the `auth` middleware group, right below the existing GET route for messages. Your route group should now look like this:

```php
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [ConversationController::class, 'index'])->name('dashboard');

    // it give the messages of this conversation
    Route::get('conversations/{conversation}/messages', [MessageController::class, 'show'])
        ->name('conversations.messages');

    // save a new message to this conversation
    Route::post('conversations/{conversation}/messages', [MessageController::class, 'store'])
        ->name('conversations.messages.store');
});
```

**Why is it the same URL but different method?**
- The **GET** route (`Route::get(...)`) is for reading — "give me the messages."
- The **POST** route (`Route::post(...)`) is for creating — "save this new message."
- Same URL, different HTTP method. This is how RESTful APIs work. Think of it like a mailbox: you can **look inside** (GET) to read your mail, or you can **put a letter in** (POST) to send mail. Same mailbox, different actions.

**Why the name `conversations.messages.store`?**
- We already have `conversations.messages` for the GET route (fetching messages). We add `.store` to distinguish this one. The name lets us use `route('conversations.messages.store', $conversation)` in our code instead of typing the full URL.

---

### Step 3: Make the Send Button Work in `Home.tsx`

This is the biggest step. We need to:
1. Track what the user is typing in the input box.
2. When they press Send (or hit Enter), send the message to the backend.
3. When the backend confirms it saved, add the message to the chat window.

#### Sub-step 3.1: Add a State Variable for the Input

We need React to remember what the user is typing. Right now the `<input>` field is "uncontrolled" — React doesn't know what's inside it.

1. Open `resources/js/pages/Home.tsx`.

2. Inside the `Home` component, find the line where we track `loadingMessages` (line 123). Right below it, add a new state variable:

```typescript
    // tracks what the user is currently typing in the message input box
    const [newMessage, setNewMessage] = useState('');
```

**Why do we need this?**
- In React, if you want to read what someone typed into an input field, you need to "control" it. That means you store the typed text in a state variable (`newMessage`), and the input reads from that variable. When the user types, you update the variable. This pattern is called a **controlled input**.
- `useState('')` means the input starts empty (an empty string `''`).

#### Sub-step 3.2: Create the `sendMessage` Function

We need a function that takes the typed message, sends it to the backend, and updates the chat window.

3. Below the existing `selectConversation` function (after its closing `};` around line 145), add the `sendMessage` function:

```typescript
    // ======== SEND MESSAGE ==========
    // sends the typed message to the backend, saves it, and shows it in the chat window
    const sendMessage = async () => {
        // don't send if there's no active conversation or the message is empty
        if (!activeConvo || newMessage.trim() === '') return;

        try {
            const response = await fetch(`/conversations/${activeConvo.id}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                },
                body: JSON.stringify({ body: newMessage }),
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            // the backend returns the saved message in the format we need
            const savedMessage = await response.json();

            // add the new message to the end of the chat list
            setChatMessages((prev) => [...prev, savedMessage]);

            // clear the input box so the user can type a new message
            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };
```

**Let's break this down piece by piece:**

##### The Guard Clause
```typescript
if (!activeConvo || newMessage.trim() === '') return;
```
- **What is this?** It's a safety check that runs before we do anything. Think of it like a guard at the door.
- **`!activeConvo`** — If no conversation is selected, there's nowhere to send the message. So we stop.
- **`newMessage.trim() === ''`** — `.trim()` removes spaces from the beginning and end of the text. If someone presses the spacebar 10 times and hits send, `newMessage` would be `'          '` but `.trim()` turns that into `''`. So we check: after removing spaces, is the message empty? If yes, don't send it. We don't want blank messages in the database.
- **`return`** — This stops the function immediately. Nothing below this line runs.

##### The Fetch Request
```typescript
const response = await fetch(`/conversations/${activeConvo.id}/messages`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
    },
    body: JSON.stringify({ body: newMessage }),
});
```
- **`method: 'POST'`** — In Feature 2.2, we used `fetch()` with the default method which is GET (reading data). Now we need POST (sending/creating data). We tell `fetch` this by setting `method: 'POST'`.
- **`'Content-Type': 'application/json'`** — This tells Laravel: "Hey, the data I'm sending you is in JSON format." Without this header, Laravel wouldn't know how to read the data.
- **`'X-CSRF-TOKEN'`** — This is a **security token**. Laravel requires it on every POST request to prevent a type of attack called CSRF (Cross-Site Request Forgery). Imagine a malicious website tricks your browser into sending a POST request to Syncora — without this token, Laravel would accept it. With the token, Laravel knows the request actually came from your app, not from a hacker's website. Laravel puts this token in a `<meta>` tag in the HTML, and we grab it with `document.querySelector`.
- **`body: JSON.stringify({ body: newMessage })`** — This is the actual data we're sending. `JSON.stringify` converts the JavaScript object `{ body: "Hello!" }` into a JSON string `'{"body":"Hello!"}'` so it can travel over the network. The key is `body` because that's what our Laravel validation expects (`$request->validate(['body' => ...])`)

##### Error Handling
```typescript
if (!response.ok) {
    throw new Error('Failed to send message');
}
```
- **What is `response.ok`?** It's a boolean that is `true` when the HTTP status code is between 200-299 (success). If the server sends back a 422 (validation error) or 403 (forbidden) or 500 (server error), `response.ok` is `false`.
- **Why `throw`?** When we throw an error, JavaScript immediately jumps to the `catch` block below. This stops us from trying to read the response as JSON when something went wrong.

##### Adding the Message to the Chat
```typescript
const savedMessage = await response.json();
setChatMessages((prev) => [...prev, savedMessage]);
```
- **`savedMessage`** — The backend returns the new message in JSON format (with `id`, `sender`, `content`, `time`, `isOwn`). We parse that JSON into a JavaScript object.
- **`setChatMessages((prev) => [...prev, savedMessage])`** — This is how you add an item to the end of a React state array.
  - `prev` is the current array of messages (all the messages currently displayed).
  - `...prev` is the spread operator — it "unpacks" all existing messages.
  - `savedMessage` is the new message we want to add at the end.
  - So `[...prev, savedMessage]` means: "Create a new array with all the old messages, plus the new one at the end."
  - This is React's way of saying "add this message to the bottom of the chat."

##### Clearing the Input
```typescript
setNewMessage('');
```
- After sending, we clear the input box so the user can type a new message. Just like when you send a message on Messenger — the text disappears from the input after you press send.

#### Sub-step 3.3: Connect the Input and Button to the Function

Now we need to hook up the HTML input and button to use our new state variable and function.

4. Find the message input section in the JSX (around line 322). Replace the entire `<input>` and send `<button>` block. Find this code:

```tsx
{/* Message Input */}
{activeConvo && (
    <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-background">
        <div className="flex items-center gap-3 bg-muted/50 dark:bg-muted/20 rounded-full px-5 py-3 border border-border transition-all focus-within:border-accent dark:focus-within:border-accent-alt focus-within:ring-1 focus-within:ring-accent/20">
            <input
                type="text"
                placeholder="Type a message..."
                className="flex-1 bg-transparent text-sm font-sans text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button
                className="flex-shrink-0 w-8 h-8 rounded-full bg-accent dark:bg-accent-alt flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                aria-label="Send message"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
            </button>
        </div>
    </div>
)}
```

Replace it with:

```tsx
{/* Message Input */}
{activeConvo && (
    <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-background">
        <div className="flex items-center gap-3 bg-muted/50 dark:bg-muted/20 rounded-full px-5 py-3 border border-border transition-all focus-within:border-accent dark:focus-within:border-accent-alt focus-within:ring-1 focus-within:ring-accent/20">
            <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                }}
                className="flex-1 bg-transparent text-sm font-sans text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button
                onClick={sendMessage}
                disabled={newMessage.trim() === ''}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-accent dark:bg-accent-alt flex items-center justify-center text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                aria-label="Send message"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
            </button>
        </div>
    </div>
)}
```

**What changed and why:**

##### On the `<input>`:
- **`value={newMessage}`** — This connects the input to our state variable. Whatever is in `newMessage`, that's what shows in the input. This makes it a **controlled input**.
- **`onChange={(e) => setNewMessage(e.target.value)}`** — Every time the user types a letter, this runs. `e.target.value` is the current text in the input. We save it to our state variable. This is how React "knows" what the user is typing.
- **`onKeyDown={(e) => { ... }}`** — This listens for keyboard presses.
  - `e.key === 'Enter'` — Did the user press the Enter key?
  - `!e.shiftKey` — They did NOT hold Shift. (In many chat apps, Shift+Enter inserts a new line, while Enter sends the message.)
  - `e.preventDefault()` — Stops the browser from doing its default action (which would be adding a newline character).
  - `sendMessage()` — Calls our send function!

##### On the `<button>`:
- **`onClick={sendMessage}`** — When the button is clicked, send the message.
- **`disabled={newMessage.trim() === ''}`** — If the message is empty (or only spaces), the button becomes disabled. You can't click a disabled button. This prevents accidental blank messages.
- **`disabled:opacity-40`** — When the button is disabled, it becomes semi-transparent (40% opacity). This gives the user a visual hint that they need to type something before they can send.

---

### Step 4: Add the CSRF Meta Tag

Remember that `X-CSRF-TOKEN` header we're sending in the fetch request? We need to make sure the CSRF token is available in the HTML as a `<meta>` tag so JavaScript can find it.

1. Open `resources/views/app.blade.php` (this is the main Blade template that wraps your React app).

2. Check if there's already a `<meta name="csrf-token">` tag inside the `<head>` section. Laravel starter kits usually include it by default. It looks like this:

```html
<meta name="csrf-token" content="{{ csrf_token() }}">
```

3. If it's already there, you're good — skip to Step 5. If it's NOT there, add it inside the `<head>` tag.

**Why is this needed?**
- Laravel generates a unique security token for each user session. This token is embedded in the HTML page as a `<meta>` tag.
- When our JavaScript sends a POST request, it grabs this token from the `<meta>` tag and includes it in the request header.
- Laravel checks: "Does the token in the request match the one I generated for this session?" If yes, the request is legit. If no, Laravel blocks it.
- This prevents **CSRF attacks** — where a malicious website tricks your browser into making requests to Syncora without your knowledge.

---

### Step 5: Write the Pest Test

We need to test two things:
1. A logged-in user can send a message and it gets saved to the database.
2. A user who doesn't belong to a conversation cannot send messages to it.

1. Open `tests/Feature/MessageControllerTest.php`.

2. Add these two new tests at the bottom of the file:

```php
test('logged in user can send a message to their conversation', function () {
    // 1. ARRANGE: create 2 users and a conversation
    /** @var \App\Models\User $user */
    $user = User::factory()->create();

    /** @var \App\Models\User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 2. ACT: send a POST request with a message body
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => 'Hello from the test!']
    );

    // 3. ASSERT: the response is 201 Created and the message is in the database
    $response->assertCreated();
    $response->assertJsonFragment([
        'content' => 'Hello from the test!',
        'isOwn' => true,
    ]);

    $this->assertDatabaseHas('messages', [
        'conversation_id' => $conversation->id,
        'sender_id'       => $user->id,
        'receiver_id'     => $otherUser->id,
        'body'            => 'Hello from the test!',
    ]);
});

test('user cannot send a message to a conversation they do not belong to', function () {
    // 1. ARRANGE: create a conversation that the user is NOT part of
    /** @var \App\Models\User $user */
    $user = User::factory()->create();

    /** @var \App\Models\User $stranger1 */
    $stranger1 = User::factory()->create();

    /** @var \App\Models\User $stranger2 */
    $stranger2 = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$stranger1->id, $stranger2->id]);

    // 2. ACT: try to send a message as the outsider
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => 'I should not be able to send this!']
    );

    // 3. ASSERT: we get a 403 Forbidden response
    $response->assertForbidden();

    // also verify the message was NOT saved to the database
    $this->assertDatabaseMissing('messages', [
        'body' => 'I should not be able to send this!',
    ]);
});

test('user cannot send an empty message', function () {
    // 1. ARRANGE
    /** @var \App\Models\User $user */
    $user = User::factory()->create();

    /** @var \App\Models\User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 2. ACT: send a POST request with an empty body
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => '']
    );

    // 3. ASSERT: we get a 422 validation error
    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('body');
});
```

**Let's break down the tests:**

#### Test 1: "logged in user can send a message to their conversation"
- **ARRANGE**: We create two users and a conversation, then put both users in that conversation. This sets up a realistic scenario.
- **ACT**: We use `->postJson(...)` instead of `->getJson(...)`. `postJson` sends a POST request (creating data) while `getJson` sends a GET request (reading data). We pass `['body' => 'Hello from the test!']` as the message data.
- **ASSERT**:
  - `assertCreated()` — Checks the response status is `201`. This confirms our controller returned the right status code.
  - `assertJsonFragment(...)` — Checks the response JSON contains the message we sent. This confirms the controller is returning the message in the correct format.
  - `assertDatabaseHas(...)` — Goes directly into the database and checks if a row exists in the `messages` table with these values. This is the most important check — it confirms the message was actually saved, not just returned.

#### Test 2: "user cannot send a message to a conversation they do not belong to"
- This is the security test. We create a conversation between two strangers, then try to send a message as a different user who is NOT in that conversation.
- `assertForbidden()` — Checks we get a `403` status code. Our authorization check is working.
- `assertDatabaseMissing(...)` — Checks that the message was NOT saved. Even though the request was sent, the database should be clean. This double-checks that the abort happened before the `Message::create()` line.

#### Test 3: "user cannot send an empty message"
- This tests our validation. We send a message with an empty `body`.
- `assertUnprocessable()` — Checks we get a `422` status code. This is what Laravel's `->validate()` automatically returns when validation fails.
- `assertJsonValidationErrors('body')` — Checks the error response mentions the `body` field. This confirms Laravel told the frontend "the body field is required."

---

### Step 6: Run the Tests

After writing all the code, let's verify everything works.

1. In your terminal, run all the message-related tests:
   ```bash
   php artisan test --filter=MessageControllerTest
   ```

2. You should see all tests passing:
   ```
   PASS  Tests\Feature\MessageControllerTest
   ✓ logged in user can view messages for their conversation
   ✓ user cannot view messages for a conversation they do not belong to
   ✓ logged in user can send a message to their conversation
   ✓ user cannot send a message to a conversation they do not belong to
   ✓ user cannot send an empty message
   ```

3. Also run the lint check before pushing:
   ```bash
   npm run lint && npm run types:check
   ```

---

### Step 7: Test It Manually

1. Start your development server:
   ```bash
   php artisan serve
   ```
   And in another terminal:
   ```bash
   npm run dev
   ```

2. Log in and go to the dashboard.

3. Click on a conversation in the sidebar. The chat window should load the existing messages (this already worked from Feature 2.2).

4. Type a message in the input box and press Enter or click the Send button.

5. The message should appear at the bottom of the chat window instantly.

6. Refresh the page — the message should still be there (because it's saved in the database, not just in React memory).

---

## Summary of Changes

| File | What Changed |
|------|-------------|
| `app/Http/Controllers/MessageController.php` | Added the `store()` method and imported the `Message` model |
| `routes/web.php` | Added a new POST route for sending messages |
| `resources/js/pages/Home.tsx` | Added `newMessage` state, `sendMessage` function, connected the input and button |
| `tests/Feature/MessageControllerTest.php` | Added 3 new tests (send message, forbidden, empty validation) |

---

## How the Full Flow Works

Here's what happens when you type "Hello!" and press Send:

1. **You type "Hello!"** → React stores it in the `newMessage` state variable.
2. **You press Enter** → The `onKeyDown` handler fires, calls `sendMessage()`.
3. **`sendMessage()` runs** → It checks: is there an active convo? Is the message not empty? Yes and yes, so it continues.
4. **JavaScript sends a POST request** → `fetch('/conversations/5/messages', { method: 'POST', body: '{"body":"Hello!"}' })` goes to the backend.
5. **Laravel receives the request** → The route matches, so it calls `MessageController@store`.
6. **Authorization check** → Laravel verifies you belong to conversation #5. You do, so it continues.
7. **Validation** → Laravel checks that `body` is not empty, is a string, and is under 5,000 characters. It passes.
8. **Save to database** → `Message::create(...)` inserts a new row into the `messages` table.
9. **Return JSON** → Laravel sends back the new message as JSON with a `201` status.
10. **React receives the response** → `savedMessage` now contains the message data.
11. **Update the chat** → `setChatMessages((prev) => [...prev, savedMessage])` adds the message to the end of the list.
12. **Clear the input** → `setNewMessage('')` empties the input box.
13. **React re-renders** → The chat window now shows the new "Hello!" message at the bottom. The input box is empty and ready for the next message.
