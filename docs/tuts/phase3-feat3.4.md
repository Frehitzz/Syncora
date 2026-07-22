# Phase 3 — Feature 3.4: "Typing..." Indicator (Whisper Events)

In Feature 3.3, we made the green online dot **real** using Presence Channels. Now you can see who's connected. But when someone is actively composing a message to you, there's no visual feedback — you just stare at a silent chat window until a message magically appears.

In this feature, we'll add a **"typing..." indicator**. When Alice is typing a message, Bob will see "Alice is typing..." appear below her name in the chat header. This is powered by **Whisper events** — ephemeral, client-side-only events that travel through the WebSocket but **never touch the server or database**. They're perfect for throwaway states that don't need persistence.

---

## 🧠 Before We Code: Understanding the Concepts

### What is a Whisper Event?

Imagine you're in a classroom and the teacher (the server) is giving a lecture. You want to nudge your friend sitting next to you — maybe tap their arm to get their attention. You don't need the teacher to know about it, you don't need it written in the class notes, and it definitely shouldn't be on the exam. It's just a quick, private tap between two people.

A **Whisper event** is exactly that kind of nudge, but over WebSockets. It's a message sent directly from one browser to another through the WebSocket server (Reverb), but **the Laravel backend never sees it**. There's no HTTP request, no controller, no database write. The event exists only in the moment — once it's received, it's gone.

Key characteristics:
- **Client-to-client only** — no server-side code involved in sending or receiving.
- **Ephemeral** — whispers are never stored anywhere.
- **Uses existing channels** — whispers travel on Private or Presence channels you've already joined.
- **Perfect for "typing..." indicators** — we don't want to save "Alice started typing at 3:42 PM" to the database. That would be silly.

### How Does Echo Handle Whispers?

Laravel Echo provides two methods for whisper events:

- **`.whisper('eventName', data)`** — Sends a whisper event to everyone else on the channel.
- **`.listenForWhisper('eventName', callback)`** — Listens for incoming whisper events from other users.

These are methods on the **channel object** (the same `window.Echo.private(...)` we already use for messages). You don't need to create any PHP event class, no `broadcastOn()`, no `broadcastWith()`. Everything stays in JavaScript.

### What is Debouncing?

Imagine you're in an elevator, and every time someone walks up and presses the "door open" button, the 5-second door-close timer resets. The door only closes when nobody has pressed the button for 5 full seconds.

**Debouncing** works the same way. Every time the user presses a key, we reset a timer. Only when they **stop typing for 2 seconds** do we hide the "typing..." indicator. This prevents the indicator from flickering on and off with every keystroke.

In code, we'll use `setTimeout` + `clearTimeout` — each new keystroke clears the old timer and starts a fresh 2-second countdown.

---

### The Full Flow for This Feature

Here is the complete picture of what will happen after we build this:

```
1. Alice starts typing in the message input
        │
        ▼ (React detects keydown on the <input>)
2. onKeyDown handler fires
        │
        ▼ (NEW — this is what we're building)
3. Echo sends a whisper event: .whisper('typing', { name: 'Alice' })
        │
        ▼ (Reverb relays the whisper to everyone on the private channel)
4. Bob's browser receives the whisper via .listenForWhisper('typing', callback)
        │
        ▼ (NEW — React state update)
5. Bob sees "Alice is typing..." below the user name in the chat header
        │
        ▼ (NEW — 2-second debounce timer starts)
6. If Alice stops typing for 2 seconds → the indicator disappears 🎉
   If Alice types again → the 2-second timer resets
```

Steps 1–2 already exist (the input and `onKeyDown` handler are there for sending messages). We're building steps 3–6 in this tutorial.

> **Important difference from MessageSent:** The `MessageSent` event goes through Laravel (controller → event → broadcast). A whisper event skips Laravel entirely. It goes straight from Alice's browser → Reverb → Bob's browser. That's why we don't need to create any PHP files for this feature.

---

## Now Let's Build It! 🔨

---

## Step 1: Add Typing State to Home.tsx

**What is this?**
We need React to "remember" two things: (1) whether someone is currently typing, and (2) who that person is. Without state variables for this, React has nowhere to store the information and can't update the UI.

1. Open `resources/js/pages/Home.tsx` and find the **state declarations section** (around line 173, near the `onlineUserIds` state). Add the following two new state variables right below the online users state:

```tsx
// ... (leave existing state as-is) ...

// ======== ONLINE USERS STATE ==========
// Tracks which user IDs are currently online via presence channel
// This is a Set because we only need to check "is this user online?" (fast lookups)
const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());

// ======== TYPING INDICATOR STATE ========== ← ADD THIS
// Tracks the name of the user who is currently typing in the active conversation
// null means nobody is typing (hide the indicator)
const [typingUser, setTypingUser] = useState<string | null>(null);
```

**Let's break down every part of this:**

#### `useState<string | null>(null)`
We use `string | null` because the value is either the name of the person typing (e.g., `"Alice"`) or `null` when nobody is typing. Starting with `null` means the indicator is hidden by default.

> **Why not a boolean?**
> A boolean like `isTyping` would only tell us *that* someone is typing, but not *who*. We need the user's name to display "Alice is typing..." in the UI.

---

## Step 2: Send a Whisper Event When the User Types

**What is this?**
When the current user presses a key in the message input, we need to broadcast a "typing" whisper to the other user on the same private conversation channel. This step wires up the *sending* side of the typing indicator.

1. Open `resources/js/pages/Home.tsx` and find the **message input's `onKeyDown` handler** (around line 740). Currently it only handles the Enter key to send messages. We need to add a whisper call for all other keystrokes.

2. First, we need access to the current user's name. Find the component's opening lines (around line 125) and add the `usePage` import and extract the authenticated user. Update the imports at the top of the file:

```tsx
import { Head, Link, usePage } from '@inertiajs/react'; // ← ADD usePage
```

3. Inside the `Home` component function, right below the `useAppearance` hook (around line 126), add:

```tsx
export default function Home({ conversations = [] }: { conversations?: Conversation[] }) {
    const { resolvedAppearance, updateAppearance } = useAppearance();

    // ======== CURRENT USER DATA ========== ← ADD THIS
    // Get the authenticated user's data from Inertia's shared page props
    // We need the name to include in the whisper event so the receiver knows WHO is typing
    const { auth } = usePage().props;

    // ... (leave everything else as-is) ...
```

4. Now find the `<input>` element for the message box (around line 735). Replace the existing `onKeyDown` handler to include the whisper:

```tsx
<input
    type="text"
    placeholder="Type a message..."
    value={newMessage}
    onChange={(e) => setNewMessage(e.target.value)}
    onKeyDown={(e) => {
        // ── Send the message when Enter is pressed ──
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
            return; // ← ADD: stop here so we don't send a whisper for the Enter key
        }

        // ── Broadcast a "typing" whisper to the other user ── ← ADD THIS BLOCK
        // This only fires for non-Enter keys (actual typing)
        // The whisper travels: our browser → Reverb → other user's browser
        // It NEVER touches the Laravel backend or database
        if (activeConvo) {
            window.Echo.private(`conversation.${activeConvo.id}`)
                .whisper('typing', {
                    name: auth.user?.name ?? 'Someone', // who is typing
                });
        }
    }}
    className="flex-1 bg-transparent text-sm font-sans text-foreground placeholder:text-muted-foreground outline-none"
/>
```

**Let's break down every part of this:**

#### `return;` after `sendMessage()`
Without this `return`, pressing Enter would both send the message AND fire a typing whisper. That would cause a brief flash of "typing..." on the receiver's screen right as the message arrives — confusing and wrong.

#### `window.Echo.private(\`conversation.${activeConvo.id}\`)`
We're reusing the **same private channel** that messages are sent on (`conversation.{id}`). We don't need to create a new channel — whispers piggyback on existing channel subscriptions.

#### `.whisper('typing', { name: auth.user?.name })`
- `'typing'` is the event name — we'll listen for this exact string on the receiving end.
- `{ name: ... }` is the payload — we send the user's name so the receiver can display "Alice is typing..." instead of just "Someone is typing...".

> **Why not use the presence channel (`chat`) instead?**
> The `chat` presence channel is shared by ALL users across ALL conversations. If Alice whispers "typing" on the `chat` channel, EVERY user in the app would see the indicator, not just Bob. By using the conversation-specific private channel (`conversation.5`), only participants of that conversation hear the whisper.

---

## Step 3: Listen for Whisper Events and Show the Indicator

**What is this?**
Now we need the *receiving* side. When the other user's whisper arrives, we update our `typingUser` state to show the indicator, and start a 2-second timer to auto-hide it when they stop typing.

1. Open `resources/js/pages/Home.tsx` and find the **real-time message listener `useEffect`** (around line 367). This is where we subscribe to the private conversation channel with `.listen('MessageSent', ...)`. We'll add `.listenForWhisper(...)` to the **same channel subscription**.

2. We also need a `useRef` to hold the debounce timer. Add this near the other refs (around line 153, near `messagesEndRef`):

```tsx
// ======== AUTO-SCROLL TO BOTTOM ==========
const messagesEndRef = useRef<HTMLDivElement>(null);

// ======== TYPING INDICATOR TIMER ========== ← ADD THIS
// Holds the setTimeout ID so we can clear it when a new keystroke arrives
// useRef (not useState) because changing a timer ID should NOT cause a re-render
const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

3. Now update the real-time listener `useEffect` to include whisper listening. Find the existing `.listen('MessageSent', ...)` block and add `.listenForWhisper(...)` right after it — on the **same channel chain**:

```tsx
// ========== REAL-TIME MESSAGE LISTENER ==========
// Whenever the active conversation changes, we subscribe to its WebSocket channel.
// When a new MessageSent event arrives, we add the message to the chat.
useEffect(() => {
    // Don't set up a listener if there's no active conversation
    if (!activeConvo) {
        return;
    }

    // Subscribe to the private channel for this conversation
    // "private" means the user must be authorized (checked in channels.php)
    window.Echo.private(`conversation.${activeConvo.id}`)
        .listen('MessageSent', (data: Message) => {
            // "data" contains everything we returned in broadcastWith()

            setChatMessages((prev) => {
                // PREVENT DUPLICATES: React StrictMode (during development)
                // sometimes registers the WebSocket listener twice.
                // This ensures we never add the same message ID twice!
                const isDuplicate = prev.some((msg) => msg.id === data.id);

                if (isDuplicate) {
                    return prev;
                }

                // Add the incoming message to the end of the chat list
                return [...prev, data];
            });
        })
        // ── Listen for typing whisper events ── ← ADD THIS ENTIRE BLOCK
        .listenForWhisper('typing', (data: { name: string }) => {
            // Show the typing indicator with the sender's name
            setTypingUser(data.name);

            // Clear any existing timer — this is the "elevator door button" reset
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Start a new 2-second timer
            // If no more whispers arrive in 2 seconds, hide the indicator
            typingTimeoutRef.current = setTimeout(() => {
                setTypingUser(null); // hide the indicator
            }, 2000);
        });

    // CLEANUP FUNCTION:
    // When the user clicks a different conversation (activeConvo changes),
    // React will run this cleanup function FIRST to unsubscribe from the old channel.
    return () => {
        window.Echo.leave(`conversation.${activeConvo.id}`);

        // Also clear any pending typing timer to prevent state updates on unmounted components ← ADD
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        setTypingUser(null); // reset typing indicator when switching conversations ← ADD
    };
}, [activeConvo]); // Re-run this effect every time activeConvo changes
```

**Let's break down every part of this:**

#### `.listenForWhisper('typing', callback)`
This is the receiving counterpart to `.whisper('typing', ...)`. It listens for whisper events named `'typing'` on the same private channel. The callback receives the data object `{ name: 'Alice' }` that the sender attached.

#### The Debounce Pattern: `clearTimeout` + `setTimeout`
```
Keystroke 1 → set timer (2 seconds)
Keystroke 2 (0.3s later) → CLEAR old timer, set NEW timer (2 seconds)
Keystroke 3 (0.5s later) → CLEAR old timer, set NEW timer (2 seconds)
... silence for 2 seconds ...
Timer fires → setTypingUser(null) → indicator disappears
```

This is the elevator door pattern in action. Each whisper event resets the countdown. The indicator only disappears after 2 full seconds of silence.

#### `typingTimeoutRef` (useRef, not useState)
We use `useRef` instead of `useState` for the timer ID because:
- Changing a timer ID is an **internal implementation detail** — the UI doesn't care about the timer's numeric ID.
- `useState` would trigger a re-render every time we clear/set a timer. That's wasteful.
- `useRef` stores the value silently, like a hidden pocket. It persists across renders without causing re-renders.

#### Cleanup: Clearing the timer on conversation switch
If the user switches conversations while someone is typing, we need to:
1. Clear the pending timer (to prevent `setTypingUser(null)` from firing on the wrong conversation context).
2. Reset `typingUser` to `null` (so the new conversation starts with a clean indicator state).

> **What happens if two people type at the same time?**
> In a 1-on-1 chat, there's only one "other" person, so `typingUser` will always show one name. If you later add group chats, you'd change `typingUser` from a `string | null` to a `Map<number, string>` to track multiple typers.

---

## Step 4: Display the Typing Indicator in the Chat Header

**What is this?**
We have the state (`typingUser`) being set when whisper events arrive, but nothing in the UI is reading it. Now we add the visual "Alice is typing..." text below the user's name in the chat header — the same spot that currently shows "Active now" or "Offline".

1. Open `resources/js/pages/Home.tsx` and find the **Right Top Bar** section (around line 650). Locate the `<p>` tag that currently shows the online/offline status text. We need to add a conditional that shows the typing indicator **instead of** the status when someone is typing.

2. Replace the status `<p>` tag with the typing-aware version:

```tsx
{/* Right Top Bar */}
<div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-border bg-background">
    {/* Left: Active User Info */}
    {activeConvo ? (
        <div className="flex items-center gap-3">
            <Avatar
                initials={activeConvo.avatar}
                online={activeConvo.otherUserId !== null && onlineUserIds.has(activeConvo.otherUserId)}
                size="lg"
            />
            <div>
                <p className="text-sm font-bold font-sans text-foreground">{activeConvo.name}</p>
                {/* ── Typing indicator OR online status ── */}
                {typingUser ? (  /* ← ADD: show typing indicator if someone is typing */
                    <p className="text-xs font-sans text-accent dark:text-accent-alt animate-pulse">
                        {typingUser} is typing...
                    </p>
                ) : (
                    <p className={`text-xs font-sans ${
                        activeConvo.otherUserId !== null && onlineUserIds.has(activeConvo.otherUserId)
                            ? 'text-green-500'
                            : 'text-muted-foreground'
                    }`}>
                        {activeConvo.otherUserId !== null && onlineUserIds.has(activeConvo.otherUserId)
                            ? 'Active now'
                            : 'Offline'}
                    </p>
                )}
            </div>
        </div>
    ) : (
        <p className="text-sm text-muted-foreground font-sans">Select a conversation to start chatting</p>
    )}

    {/* Right: Action Buttons */}
    {/* ... (leave action buttons as-is) ... */}
</div>
```

**Let's break down every part of this:**

#### `{typingUser ? (...typing...) : (...status...)}`
This is a **conditional render**. When `typingUser` is not `null` (someone is typing), we show the typing text. When it's `null`, we fall back to the existing online/offline status.

#### `text-accent dark:text-accent-alt`
We use the app's accent color for the typing text instead of green (online) or muted gray (offline). This gives it a distinct, eye-catching look that clearly says "something is happening right now."

#### `animate-pulse`
This is a Tailwind CSS utility that makes the text gently fade in and out, creating a subtle "breathing" animation. It draws the user's attention without being distracting — perfect for a transient state like typing.

> **Why replace the online status instead of showing both?**
> If Alice is typing, you already know she's online — she can't type if she's offline! Showing both "Active now" AND "Alice is typing..." would be redundant and cluttered. The typing indicator is a **superset** of the online status.

---

## Step 5: Test It Manually

Now let's verify everything works end-to-end. You need two browser windows to test real-time features.

1. Make sure all three servers are running:

```bash
composer dev
```

This starts the Laravel server, Vite dev server, and Reverb WebSocket server together.

2. Open **two separate browser windows** (not tabs — full windows, side by side):
   - **Window 1:** Log in as User A (e.g., Alice)
   - **Window 2:** Log in as User B (e.g., Bob)

3. In both windows, click on the conversation between Alice and Bob.

4. **In Window 1 (Alice):** Start typing in the message input box — just type slowly, one character at a time.

5. **In Window 2 (Bob):** Look at the chat header area (below the user's name). You should see:
   - **"Alice is typing..."** appears in the accent color with a pulsing animation.
   - If Alice stops typing for **2 seconds**, the indicator disappears and reverts to "Active now" or "Offline".
   - If Alice types again, the indicator reappears immediately.

6. **Test the reverse:** Type in Window 2 (Bob) and verify that Window 1 (Alice) sees "Bob is typing...".

7. **Test conversation switching:** While Alice is typing, click on a different conversation in Bob's sidebar. The typing indicator should disappear. Click back to Alice's conversation — it should also be clean (no stale indicator).

8. **Test the Enter key:** Type a message and press Enter. The typing indicator should NOT flash on the other user's screen (because we added `return;` after `sendMessage()`).

**Common issues:**

- **"Typing..." never appears** — Check the browser DevTools console for WebSocket errors. Make sure Reverb is running (`php artisan reverb:start`). Verify you're on the same conversation in both windows.

- **"Typing..." appears but never disappears** — Check that `typingTimeoutRef` is properly declared as a `useRef`. If you accidentally used `useState`, the timer would be reset on every render.

- **"Typing..." shows your OWN name** — Whisper events are only sent to *other* users on the channel, not back to the sender. If you see your own name, you might be logged into the same account in both windows.

- **"TypeError: window.Echo.private(...).whisper is not a function"** — Make sure you're using a Private or Presence channel. Whispers don't work on public channels.

---

## Step 6: Write Automated Tests

**Why do we need this?**
The most critical thing to verify about the typing indicator is what it **doesn't** do: it should NOT save anything to the database. Whisper events are purely client-side — if typing events started creating database records, you'd have millions of useless rows. This test acts as a safety net to make sure nobody accidentally wires typing events to a controller or model.

1. Create a new test file at `tests/Feature/TypingIndicatorTest.php`:

```php
<?php

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ======= VERIFY THAT TYPING EVENTS DO NOT CREATE ANY DATABASE RECORDS ==========
// Typing indicators use whisper events (client-side only).
// This test ensures that the typing feature hasn't been accidentally
// wired to a controller, event, or model that saves to the database.
test('typing events do NOT create any records in the messages table', function () {
    // 1. ARRANGE: create two users and a conversation between them
    /** @var \App\Models\User $alice */
    $alice = User::factory()->create(['name' => 'Alice']);

    /** @var \App\Models\User $bob */
    $bob = User::factory()->create(['name' => 'Bob']);

    $conversation = Conversation::create();
    $conversation->users()->attach([$alice->id, $bob->id]);

    // 2. SNAPSHOT: count how many messages exist BEFORE the "typing" interaction
    //    We take a snapshot so we can compare "before" vs "after"
    $messageCountBefore = Message::count();

    // 3. ACT: simulate what would happen if someone mistakenly created
    //    a "typing" API endpoint — we verify no such route exists
    //    by checking that common typing-related routes return 404/405
    /** @var \Tests\TestCase $this */

    // Try POST /conversations/{id}/typing — should NOT exist
    $response = $this->actingAs($alice)->postJson(
        "/conversations/{$conversation->id}/typing",
        ['typing' => true]
    );

    // The route should not exist (404) or not be a POST route (405)
    // Either way, it should NOT be a successful 200/201/204
    expect($response->status())->toBeGreaterThanOrEqual(404);

    // 4. ASSERT: the message count has NOT changed
    //    If it changed, it means something in the app is saving typing events
    $messageCountAfter = Message::count();
    expect($messageCountAfter)->toBe($messageCountBefore);
});

// ======= VERIFY NO "TYPING" ROUTE EXISTS IN THE APPLICATION ==========
// This is a guard-rail test: if a future developer accidentally adds
// a route to handle typing events server-side, this test will fail
// and remind them that typing should stay client-side only.
test('no server-side typing route exists for conversations', function () {
    /** @var \App\Models\User $user */
    $user = User::factory()->create();

    /** @var \App\Models\Conversation $conversation */
    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id]);

    /** @var \Tests\TestCase $this */

    // Try all common HTTP methods on a hypothetical typing endpoint
    $postResponse = $this->actingAs($user)->postJson("/conversations/{$conversation->id}/typing");
    $getResponse = $this->actingAs($user)->getJson("/conversations/{$conversation->id}/typing");
    $putResponse = $this->actingAs($user)->putJson("/conversations/{$conversation->id}/typing");

    // ALL of these should fail — typing is client-side only
    // 404 = route doesn't exist, 405 = method not allowed
    // Both are acceptable — what's NOT acceptable is 200, 201, or 204
    expect($postResponse->status())->toBeGreaterThanOrEqual(400);
    expect($getResponse->status())->toBeGreaterThanOrEqual(400);
    expect($putResponse->status())->toBeGreaterThanOrEqual(400);
});

// ======= VERIFY THE MESSAGES TABLE IS CLEAN AFTER SIMULATED TYPING ==========
// This is an extra safety check: even if we send multiple requests
// pretending to be "typing" events, the database should remain untouched.
test('database remains clean after simulated typing activity', function () {
    // 1. ARRANGE
    /** @var \App\Models\User $user */
    $user = User::factory()->create();

    /** @var \App\Models\User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 2. ACT: send a real message (this SHOULD create a record)
    /** @var \Tests\TestCase $this */
    $this->actingAs($user)->postJson(
        route('conversations.messages.store', $conversation),
        ['body' => 'Hello Bob!']
    );

    // 3. ASSERT: exactly 1 message exists — the real one we just sent
    expect(Message::count())->toBe(1);
    expect(Message::first()->body)->toBe('Hello Bob!');

    // 4. ACT: try the typing route again (should not exist)
    $this->actingAs($user)->postJson("/conversations/{$conversation->id}/typing", [
        'typing' => true,
        'user' => $user->name,
    ]);

    // 5. ASSERT: still exactly 1 message — typing didn't create anything
    expect(Message::count())->toBe(1);
});
```

**Let's break down the test concepts:**

#### Why Test Something That Doesn't Exist?

This is a **guard-rail test** — also called a "negative test" or "regression guard." It doesn't test functionality we built; it tests a **constraint** we want to protect: "typing must NEVER create database records."

Think of it like a smoke detector. You don't install it because your house is on fire — you install it because you want to know the moment something goes wrong in the future. If someone accidentally adds a `typing` route six months from now, this test will fail and catch the mistake.

#### `expect($response->status())->toBeGreaterThanOrEqual(404)`

We check that the HTTP status is 404 (Not Found) or higher. A `200` or `201` would mean a typing route exists and is handling requests — that's exactly what we want to prevent.

#### Snapshot Pattern (`$messageCountBefore` vs `$messageCountAfter`)

This is a common testing technique:
1. Count the records before the action.
2. Perform the action.
3. Count the records after.
4. Compare — they should be equal (nothing was added).

It's like counting the books on a shelf before and after someone visits the library. If the count changed, something unexpected happened.

2. Run the tests:

```bash
php artisan test --filter=TypingIndicatorTest
```

You should see all 3 tests pass:

```
✓ typing events do NOT create any records in the messages table
✓ no server-side typing route exists for conversations
✓ database remains clean after simulated typing activity
```

3. Run the full test suite to make sure nothing is broken:

```bash
php artisan test
```

---

## ✅ "Typing..." Indicator Checklist

- [ ] `typingUser` state added to `Home.tsx` (`string | null`, starts as `null`)
- [ ] `typingTimeoutRef` ref added to hold the debounce timer ID
- [ ] `usePage` imported and `auth` destructured for the current user's name
- [ ] `.whisper('typing', { name })` called on `onKeyDown` (non-Enter keys only)
- [ ] `return;` added after `sendMessage()` to prevent whisper on Enter key
- [ ] `.listenForWhisper('typing', callback)` added to the channel subscription `useEffect`
- [ ] Debounce logic: `clearTimeout` + `setTimeout(2000)` to auto-hide the indicator
- [ ] Cleanup: timer cleared and `typingUser` reset when switching conversations
- [ ] Chat header shows "Alice is typing..." when `typingUser` is set
- [ ] Typing text styled with accent color and `animate-pulse` animation
- [ ] Online/offline status text hidden when typing indicator is active
- [ ] Manual test: typing in one window shows indicator in the other
- [ ] Manual test: indicator disappears after 2 seconds of no typing
- [ ] Manual test: pressing Enter does NOT flash the typing indicator
- [ ] Manual test: switching conversations clears the typing indicator
- [ ] Automated test: typing events create no database records
- [ ] Automated test: no server-side typing route exists
- [ ] Automated test: database stays clean after simulated typing
- [ ] All tests passing: `php artisan test`

---

## 🔮 What's Next? (Feature 4.1 — Email Notification for Offline Users Preview)

With Features 3.1–3.4, you've mastered real-time communication: messages broadcast instantly, users show as online/offline, and typing indicators provide live feedback. But what happens when User B is **offline** and misses a message?

In Phase 4, we'll tackle **Background Jobs & Queues**. Feature 4.1 will send an email notification to offline users when they receive a new message. But since sending emails is slow (1–3 seconds), we can't make the sender wait. Instead, we'll push the email task to a **background queue** — the app stays fast, and the email gets sent behind the scenes. You'll learn to use `Queue::fake()` in tests, just like you used `Event::fake()` for broadcasting!

---

> **Tip:** To confirm that whisper events truly stay client-side, open your browser's DevTools → Network tab and filter by "Fetch/XHR" while you type. You should see **zero** HTTP requests being made. All communication happens over the existing WebSocket connection (visible in the WS tab). If you see fetch requests, something is misconfigured.
