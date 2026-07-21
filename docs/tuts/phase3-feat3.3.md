# Phase 3 — Feature 3.3: Online/Offline Status (Presence Channels)

In Feature 3.2, we made messages appear instantly on the other user's screen using **Private Channels** and broadcasting. But if you look at the green dot on each avatar in the sidebar, it's fake — the `online` field is hardcoded to `false` in `ConversationController@index`.

In this feature, we'll make that green dot **real**. When a user opens Syncora, everyone else will see their green dot light up. When they close the tab or disconnect, the dot disappears. This is powered by **Presence Channels** — a special type of WebSocket channel that tracks who is currently connected.

---

## 🧠 Before We Code: Understanding the Concepts

### What is a Presence Channel?

Think of a **Private Channel** (which we already use for messages) like a locked room where only authorized people can enter. You can shout messages inside, but you have **no idea who else is in the room with you**.

A **Presence Channel** is like the same locked room, but now there's a **sign-in sheet at the door**. When someone enters, their name gets added to the sheet. When they leave, it gets removed. At any point, you can look at the sheet and see exactly who's in the room right now.

In technical terms:
- **Private Channel** → Authorized users can send/receive events, but can't see who else is listening.
- **Presence Channel** → Same as private, PLUS it tracks which users are currently connected, and fires events when people join or leave.

Laravel Echo gives us three special callbacks for presence channels:
- `here(users)` → Called once when you first connect. Gives you the full list of everyone already connected.
- `joining(user)` → Called every time a new user connects after you.
- `leaving(user)` → Called every time a user disconnects.

---

### Why Not Just Store "online" in the Database?

You might think: "Why not just save `is_online = true` in the users table?" The problem is **reliability**. What if someone's browser crashes? Their laptop dies? Their internet drops? The database would still say they're online forever.

Presence Channels solve this automatically. The WebSocket server (Reverb) knows the exact moment a user's connection drops (even if it's a crash or network failure) and immediately fires the `leaving` event. No stale data, no cleanup cron jobs.

Think of it like this: the database approach is like writing "I'm at the party" on a whiteboard — if you leave without erasing it, everyone still thinks you're there. The Presence Channel approach is like using a motion sensor at the door — it knows the instant you walk out.

---

### What is Channel Authorization for Presence Channels?

We already know about channel authorization from Feature 3.2 — in `routes/channels.php`, we tell Laravel who is allowed to listen on a channel.

For Presence Channels, the authorization callback works slightly differently. Instead of returning `true` or `false`, you return **an array of user data** when authorizing. This array is the data that other users will see in the `here()`, `joining()`, and `leaving()` callbacks.

- Return `null` or `false` → Access denied.
- Return an **array** (e.g., `['id' => 1, 'name' => 'Alice']`) → Access granted, and this data is shared with everyone else on the channel.

---

### The Full Flow for This Feature

Here is the complete picture of what will happen after we build this:

```
1. User A opens Syncora (page loads in browser)
         │
         ▼ (Echo connects to Reverb via WebSocket — already works!)
2. Echo joins the presence channel: presence-chat
         │
         ▼ (NEW — this is what we're building)
3. Reverb asks Laravel: "Is User A allowed on presence-chat?"
         │
         ▼ (NEW — channel authorization)
4. channels.php returns { id: 1, name: 'Alice' } → AUTHORIZED
         │
         ▼ (Reverb notifies everyone on the channel)
5. All other connected users receive a "joining" event with User A's data
         │
         ▼ (React updates the UI)
6. User A's green dot lights up on all other users' screens 🎉

--- When User A closes the tab ---

7. Reverb detects the WebSocket disconnect
         │
         ▼ (Reverb notifies everyone on the channel)
8. All other connected users receive a "leaving" event
         │
         ▼ (React updates the UI)
9. User A's green dot disappears from all screens
```

Steps 1–2 already exist (Echo and Reverb are set up). We're building steps 3–9 in this tutorial.

---

## Now Let's Build It! 🔨

---

## Step 1: Register the Presence Channel in `channels.php`

**What is this?**
We need to tell Laravel that there's a new channel called `presence-chat` and define who is allowed to join it. Without this, Reverb will reject every user's attempt to join the channel.

1. Open `routes/channels.php` and add the new presence channel authorization at the bottom of the file:

```php
// ... (leave existing channels as-is)

/**
 * AUTHORIZE THE PRESENCE CHANNEL FOR ONLINE STATUS
 * - Every authenticated user can join this channel
 * - The returned array is the "identity card" that other users see
 */
Broadcast::channel('chat', function ($user) {
    // Return the user's data — this is what .here(), .joining(), .leaving() will receive
    // Return null or false to deny access
    return [
        'id' => $user->id,
        'name' => $user->name,
    ];
});
```

**Let's break down every part of this:**

#### `Broadcast::channel('chat', ...)`
Even though we'll connect to `presence-chat` on the frontend, Laravel strips the `presence-` prefix automatically. So we register it here as just `'chat'`. This is a Laravel convention — don't add the `presence-` prefix in `channels.php`.

#### `function ($user) { return [...]; }`
For presence channels, the callback MUST return an **array** (not `true`). This array is the user data that will be shared with everyone else on the channel. We include `id` and `name` because that's all we need to identify who is online.

If the callback returns `null` or `false`, the user is denied access. Since every authenticated user should be able to join (the middleware already ensures they're logged in), we always return the data array.

> **Why only `id` and `name`?**
> Don't include sensitive data like `email` or `password` here. This data is visible to every other user on the presence channel. Only include what you actually need for the UI.

---

## Step 2: Update the Conversation Interface to Track Online Users Separately

**What is this?**
Right now, each conversation has a hardcoded `online: boolean` field. But online status isn't really a property of a conversation — it's a property of a **user**. We need a separate piece of React state to track which user IDs are currently online, and then look up that state when rendering conversations.

1. Open `resources/js/pages/Home.tsx`. Inside the `Home` component (after the existing `useState` declarations around line 170), add the **online users state**:

```tsx
// ======== ONLINE USERS STATE ==========
// Tracks which user IDs are currently online via presence channel
// This is a Set because we only need to check "is this user online?" (fast lookups)
const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
```

**Let's break down every part of this:**

#### `useState<Set<number>>(new Set())`
We use a `Set` instead of an array because:
- **Fast lookups**: `set.has(userId)` is O(1), while `array.includes(userId)` is O(n).
- **No duplicates**: A Set automatically prevents the same user ID from being added twice.
- **Clean API**: `set.add()` and `set.delete()` are cleaner than array filter/spread operations.

We start with an empty Set because we don't know who's online yet — the presence channel will tell us when we connect.

---

## Step 3: Join the Presence Channel with Echo

**What is this?**
We need to tell Echo to join the `presence-chat` channel when the page loads. Echo will connect, receive the list of currently online users (via `here()`), and then listen for users joining and leaving.

1. In the same `Home.tsx` file, add a new `useEffect` hook. Place it **after** the existing real-time message listener `useEffect` (around line 394) and **before** the auto-load first conversation `useEffect`:

```tsx
// ========== PRESENCE CHANNEL — ONLINE STATUS ==========
// Join the presence channel once when the component mounts.
// This tracks who is currently connected to the app.
useEffect(() => {
    // Join the presence channel — Echo adds the "presence-" prefix automatically
    const channel = window.Echo.join('chat')
        // Called ONCE when we first connect — gives us everyone already online
        .here((users: { id: number; name: string }[]) => {
            // Build a Set from the array of user objects
            setOnlineUserIds(new Set(users.map((u) => u.id)));
        })
        // Called every time a NEW user comes online after us
        .joining((user: { id: number; name: string }) => {
            setOnlineUserIds((prev) => {
                const next = new Set(prev); // clone the Set (React needs a new reference to re-render)
                next.add(user.id);
                return next;
            });
        })
        // Called every time a user goes offline (closes tab, disconnects)
        .leaving((user: { id: number; name: string }) => {
            setOnlineUserIds((prev) => {
                const next = new Set(prev); // clone
                next.delete(user.id);
                return next;
            });
        });

    // CLEANUP: when the component unmounts (user navigates away), leave the channel
    return () => {
        channel.leave();
    };
}, []); // Empty array = run once on mount, clean up on unmount
```

**Let's break down every part of this:**

#### `window.Echo.join('chat')`
Unlike `window.Echo.private(...)` (which we use for message channels), `.join(...)` connects to a **Presence Channel**. Echo automatically adds the `presence-` prefix, so `join('chat')` connects to `presence-chat`.

#### `.here((users) => { ... })`
This is the "sign-in sheet" moment. The very first time you connect, Reverb sends you the complete list of everyone who is already connected. We convert this array into a Set of user IDs and store it in state.

For example, if Alice and Bob are already online when you connect, `users` will be:
```json
[
  { "id": 1, "name": "Alice" },
  { "id": 2, "name": "Bob" }
]
```

#### `.joining((user) => { ... })`
After the initial `here()` call, this fires every time a **new** user connects. We clone the existing Set (React requires a new reference to detect changes and re-render), add the new user's ID, and update state.

#### `.leaving((user) => { ... })`
The mirror of `joining()`. Fires when a user disconnects. We clone the Set, remove their ID, and update state.

#### Why clone the Set? `new Set(prev)`
React uses **reference equality** to decide if state has changed. If we just did `prev.add(user.id); return prev;`, React would see the same Set object reference and skip the re-render. By creating a `new Set(prev)`, we create a new object, which tells React: "Something changed, re-render!"

> **What about the current user?**
> The `here()` callback includes the current user too! So if you (user ID 3) connect and Alice (ID 1) is already there, `here()` will return `[{ id: 1 }, { id: 3 }]`. This is fine — we just won't display the green dot on our own avatar (we don't show ourselves in the sidebar).

---

## Step 4: Update the Conversation List to Use Real Online Status

**What is this?**
The conversation data from Laravel still has `'online' => false` hardcoded. Instead of changing the backend (which can't know the real-time WebSocket state anyway), we'll override it in the frontend using our `onlineUserIds` Set.

But first, we need to know the **other user's ID** in each conversation. Currently, the backend only sends us `name`, `avatar`, `lastMessage`, etc. — but not the other user's `id`. So we need to add it.

1. Open `app/Http/Controllers/ConversationController.php`. In the `index` method, find the `->map()` callback and add `otherUserId` to the returned array:

```php
return [
    'id' => $conversation->id,
    'otherUserId' => $otherUser ? $otherUser->id : null, // ← ADD THIS
    'name' => $otherUser ? $otherUser->name : 'Saved Messages',
    'lastMessage' => $lastMessage ? $lastMessage->body : '',
    'time' => $lastMessage ? $lastMessage->created_at->diffForHumans(short: true): '',
    'avatar' => $otherUser ? strtoupper(substr($otherUser->name, 0, 2)) : 'SM',
    'unread' => 0, // placeholder for now
    'online' => false, // placeholder for now (frontend will override this)
];
```

2. Now update the `Conversation` TypeScript interface in `Home.tsx` to include the new field. Find the interface at the top of the file (around line 9):

```tsx
interface Conversation {
    id: number;
    otherUserId: number | null; // ← ADD THIS
    name: string;
    lastMessage: string;
    time: string;
    avatar: string;
    unread: number;
    online: boolean;
}
```

3. Now update the **sidebar conversation list** to use real online status. Find the `ConversationItem` render section (around line 588–594). Replace:

```tsx
<ConversationItem
    convo={convo}
    active={activeConvo !== null && convo.id === activeConvo.id}
/>
```

With:

```tsx
<ConversationItem
    convo={{
        ...convo,
        online: convo.otherUserId !== null && onlineUserIds.has(convo.otherUserId),
    }}
    active={activeConvo !== null && convo.id === activeConvo.id}
/>
```

**What does this do?** We create a new object that spreads all the existing `convo` properties but overrides the `online` field with a real-time check: "Is the other user's ID in our set of online users?"

4. Now update the **chat header** to use real online status too. Find the right-column header section (around line 610–618). Replace:

```tsx
<Avatar initials={activeConvo.avatar} online={activeConvo.online} size="lg" />
<div>
    <p className="text-sm font-bold font-sans text-foreground">{activeConvo.name}</p>
    <p className="text-xs font-sans text-green-500">
        {activeConvo.online ? 'Active now' : 'Offline'}
    </p>
</div>
```

With:

```tsx
<Avatar
    initials={activeConvo.avatar}
    online={activeConvo.otherUserId !== null && onlineUserIds.has(activeConvo.otherUserId)}
    size="lg"
/>
<div>
    <p className="text-sm font-bold font-sans text-foreground">{activeConvo.name}</p>
    <p className={`text-xs font-sans ${
        activeConvo.otherUserId !== null && onlineUserIds.has(activeConvo.otherUserId)
            ? 'text-green-500'
            : 'text-muted-foreground'
    }`}>
        {activeConvo.otherUserId !== null && onlineUserIds.has(activeConvo.otherUserId)
            ? 'Active now'
            : 'Offline'}
    </p>
</div>
```

**What changed?** Instead of reading `activeConvo.online` (which is always `false`), we check `onlineUserIds.has(activeConvo.otherUserId)` in real-time. We also color the "Offline" text in muted gray instead of green so it doesn't look like they're online.

---

## Step 5: Test It Manually

Now let's verify that everything works end to end.

1. **Start all services** — you need three terminals running:

   ```bash
   # Terminal 1: Laravel server
   php artisan serve

   # Terminal 2: Reverb WebSocket server
   php artisan reverb:start --debug

   # Terminal 3: Vite dev server
   npm run dev
   ```

   > **Why `--debug`?** The `--debug` flag makes Reverb print every connection, subscription, and disconnection to the console. Super helpful for seeing exactly what's happening.

2. **Open two browsers** (or one regular window + one incognito window):
   - Browser 1: Log in as **User A** at `http://localhost:8000`
   - Browser 2: Log in as **User B** at `http://localhost:8000`

3. **Verify the `here()` callback**:
   - Open Browser 1 first (User A). At this point, no one else is online, so no green dots.
   - Open Browser 2 (User B). In the Reverb debug console, you should see:
     ```
     [timestamp] message: Channel 'presence-chat' member added: ...
     ```
   - In Browser 1, User B's avatar should now show a **green dot** in the sidebar.
   - In Browser 2, User A's avatar should also show a **green dot** (because User A was already connected when User B joined).

4. **Verify the `joining()` callback**:
   - With both browsers open, check that both users see each other as online (green dot + "Active now" text in the chat header).

5. **Verify the `leaving()` callback**:
   - Close Browser 2 (User B's tab).
   - In Browser 1, User B's green dot should **disappear** within a few seconds.
   - The chat header should change from "Active now" to "Offline".
   - In the Reverb debug console, you should see:
     ```
     [timestamp] message: Channel 'presence-chat' member removed: ...
     ```

6. **Where to check for errors**:
   - **Browser DevTools Console** (F12 → Console tab): Look for WebSocket connection errors or JavaScript errors.
   - **Reverb terminal**: Look for authentication failures or connection errors.
   - **Laravel log** (`storage/logs/laravel.log`): Look for channel authorization errors.

**Common issues:**
- **Green dot never appears** — Check the Reverb debug output. If you see "Auth rejected" or similar, your `channels.php` callback might have an issue. Make sure it returns an **array**, not `true`.
- **"Echo is not defined" error** — Make sure `resources/js/echo.ts` is imported in your app. Check `resources/js/app.tsx` for the import.
- **Green dot appears but never disappears** — Make sure the `leaving()` callback is working. Check the Reverb debug output for "member removed" events. If you don't see them, Reverb might not be detecting the disconnect — try hard-refreshing.
- **CORS or 403 errors in DevTools** — Make sure `BROADCAST_CONNECTION=reverb` is set in your `.env` file and that Reverb is running on the correct port (`8080` per your config).

---

## Step 6: Write Automated Tests

**Why do we need this?**
We can't easily test the real-time WebSocket behavior in an automated test (that would need a browser automation tool). But we **can** test the parts we control:

1. The presence channel **authorization** — verifying that authenticated users get the correct response data, and unauthenticated users are denied.
2. The `otherUserId` field — verifying that the backend sends the other user's ID in the conversation data.

1. Create a new test file at `tests/Feature/PresenceChannelTest.php`:

```php
<?php

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ======= VERIFY AUTHENTICATED USERS CAN JOIN THE PRESENCE CHANNEL ==========
test('authenticated user can join the presence channel and receives correct data', function () {
    // 1. ARRANGE: create a user
    /** @var \App\Models\User $user */
    $user = User::factory()->create(['name' => 'Alice']);

    // 2. ACT: simulate an auth request for the presence channel
    //    Laravel's broadcast auth endpoint is POST /broadcasting/auth
    //    We send the channel name as "presence-chat" because that's what Echo sends
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->postJson('/broadcasting/auth', [
        'channel_name' => 'presence-chat',
    ]);

    // 3. ASSERT: the response is successful (200)
    //    For presence channels, Laravel returns a JSON response with channel_data
    $response->assertOk();

    // 4. ASSERT: the channel_data contains our user's info
    //    Laravel wraps the return value from channels.php in a "channel_data" JSON string
    $channelData = json_decode($response->json('channel_data'), true);
    expect($channelData['user_id'])->toBe($user->id);
    expect($channelData['user_info']['id'])->toBe($user->id);
    expect($channelData['user_info']['name'])->toBe('Alice');
});

// ======= VERIFY GUESTS CANNOT JOIN THE PRESENCE CHANNEL ==========
test('unauthenticated user cannot join the presence channel', function () {
    // 1. ACT: try to auth without being logged in
    /** @var \Tests\TestCase $this */
    $response = $this->postJson('/broadcasting/auth', [
        'channel_name' => 'presence-chat',
    ]);

    // 2. ASSERT: access denied (401 Unauthenticated)
    $response->assertUnauthorized();
});

// ======= VERIFY CONVERSATION DATA INCLUDES OTHER USER ID ==========
test('conversation data includes otherUserId for the frontend', function () {
    // 1. ARRANGE: create two users and a conversation between them
    /** @var \App\Models\User $user */
    $user = User::factory()->create();

    /** @var \App\Models\User $otherUser */
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 2. ACT: visit the dashboard (which loads conversations via Inertia)
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->get(route('dashboard'));

    // 3. ASSERT: the response contains the conversation data with otherUserId
    $response->assertOk();

    // Inertia renders props — we check the page component and its props
    $response->assertInertia(function ($page) use ($otherUser) {
        $page->component('Home')
            ->has('conversations', 1)
            ->where('conversations.0.otherUserId', $otherUser->id);
    });
});
```

**Let's break down the test concepts:**

#### Broadcast Auth Endpoint
When Echo tries to join a private or presence channel, it sends a POST request to `/broadcasting/auth` with the `channel_name`. Laravel routes this to the channel authorization callbacks in `channels.php`. We simulate this exact flow in the test.

#### `json_decode($response->json('channel_data'), true)`
For presence channels, Laravel returns the authorization result with a `channel_data` field that contains a JSON **string** (not an object). We need to decode it to inspect the user data inside. The structure is `{ user_id: ..., user_info: { ...the array you returned in channels.php... } }`.

#### `assertInertia()`
Since the dashboard is an Inertia page, we use `assertInertia()` to inspect the props passed to the React component. This lets us verify that `otherUserId` is included in the conversation data without needing to render the actual React component.

2. Run the tests:

```bash
php artisan test --filter=PresenceChannelTest
```

You should see all 3 tests pass:

```
✓ authenticated user can join the presence channel and receives correct data
✓ unauthenticated user cannot join the presence channel
✓ conversation data includes otherUserId for the frontend
```

---

## ✅ Online/Offline Status Checklist

- [ x ] Presence channel `chat` registered in `routes/channels.php` returning user `id` and `name`
- [ x ] `onlineUserIds` state added to `Home.tsx` using a `Set<number>`
- [ x ] `useEffect` added to join `presence-chat` with `here()`, `joining()`, and `leaving()` callbacks
- [ x ] `otherUserId` added to conversation data in `ConversationController@index`
- [ x ] `Conversation` TypeScript interface updated with `otherUserId`
- [ x ] Sidebar green dot uses real `onlineUserIds.has()` instead of `convo.online`
- [ x ] Chat header "Active now" / "Offline" uses real `onlineUserIds.has()` instead of `activeConvo.online`
- [ x ] Chat header "Offline" text styled in muted gray instead of green
- [ x ] Manual testing: green dot appears when second user connects
- [ x ] Manual testing: green dot disappears when second user disconnects
- [ x ] Manual testing: "Active now" / "Offline" text updates correctly in chat header
- [ x ] Automated test: authenticated user can join the presence channel
- [ x ] Automated test: unauthenticated user is denied access
- [ x ] Automated test: `otherUserId` is included in conversation data
- [ x ] All tests passing: `php artisan test`

---

## 🔮 What's Next? (Feature 3.4 — "Typing..." Indicator Preview)

Now that we know who's online, the next feature adds another layer of real-time interactivity: **typing indicators**. When someone is typing a message to you, you'll see "Alice is typing..." appear below their name in the chat header.

This will use a feature called **Whisper events** — client-side-only events that are sent through the WebSocket but **never touch the server or database**. They're perfect for ephemeral states like "typing" that don't need to be saved. You'll be able to reuse the same presence channel concepts you just learned here!

---

> **Tip:** To debug presence channel issues, run Reverb with the `--debug` flag: `php artisan reverb:start --debug`. This shows every subscription, authentication, and member join/leave event in real-time — invaluable for understanding what's happening under the hood.
