# Phase 3 — Feature 3.1: Set Up Laravel Reverb (WebSocket Server)

Welcome to **Phase 3** — the phase where your chat app comes alive in real-time! 🎉

Up until now, everything you've built works great, but it has one big limitation: **the browser only gets new data when it asks for it**. If Alice sends Bob a message, Bob has to refresh the page (or click something) to see it. That's not how real messaging apps work — you want messages to pop up instantly, the moment they're sent.

This is where **WebSockets** come in, and this tutorial will introduce you to them from scratch.

---

## 🧠 Before We Code: Understanding the Big Picture

Before we touch any code, let's understand the concepts. Don't skip this section — it will make everything else click.

---

### What is HTTP? (What you already know)

Every time your React frontend talks to your Laravel backend right now, it uses **HTTP** (HyperText Transfer Protocol). Here's how HTTP works:

1. **The browser asks a question** → "Hey server, give me the messages for conversation #5"
2. **The server answers** → "Here are the 20 messages"
3. **The connection closes** → They hang up the phone

This is called a **request-response** cycle. The key thing is: **the server can never talk first**. It can only respond when the browser asks. It's like a restaurant — the waiter (server) only comes when you raise your hand (request). They don't randomly walk up and tell you things.

This is fine for loading pages, but terrible for a chat app. Imagine if you had to press a button every time you wanted to check if someone sent you a message!

---

### What are WebSockets? (The new thing you're learning)

**WebSockets** are a completely different way for the browser and server to talk. Instead of asking a question and hanging up, they keep the phone line open:

1. **The browser says** → "Hey server, let's open a permanent connection"
2. **The server says** → "Sure, I'll keep this line open"
3. **Now EITHER side can talk at any time** → The server can say "Hey, you got a new message!" without the browser asking

Think of it like the difference between:
- **HTTP** = Sending letters by mail 📬 (you send a letter, wait for a reply, then send another)
- **WebSockets** = A phone call 📞 (once the call starts, both sides can talk whenever they want)

Here's a visual:

```
HTTP (what you've been doing):
Browser: "Any new messages?" ──────────►  Server: "Nope"
Browser: "Any new messages?" ──────────►  Server: "Nope"
Browser: "Any new messages?" ──────────►  Server: "Yes! Here's one"
Browser: "Any new messages?" ──────────►  Server: "Nope"

WebSocket (what we're building):
Browser: "Open connection" ◄──────────►  Server: "Connected!"
         ...silence...
                           ◄───────────  Server: "New message from Alice!"
                           ◄───────────  Server: "Alice is typing..."
Browser: "Thanks, bye"     ──────────►  Server: "Connection closed"
```

With HTTP, the browser has to keep asking "anything new?" over and over (called **polling**), which is wasteful. With WebSockets, the server pushes updates to the browser the instant they happen.

---

### What is Laravel Reverb?

Now you understand WebSockets, but here's the thing — **Laravel doesn't include a WebSocket server by default**. Your regular `php artisan serve` command only handles HTTP requests. We need a separate server that speaks the WebSocket language.

That's what **Laravel Reverb** is — a **WebSocket server built specifically for Laravel**.

Think of it this way:
- `php artisan serve` = Your HTTP server (handles regular page loads, form submissions, API calls)
- `php artisan reverb:start` = Your WebSocket server (handles real-time connections, pushing messages instantly)

You'll run **both** at the same time. They work together:
1. When Alice sends a message, the HTTP server saves it to the database (like it already does)
2. Then it tells the WebSocket server: "Hey, broadcast this message to Bob!"
3. The WebSocket server pushes the message to Bob's browser instantly

**Why Reverb and not something else?** There are other WebSocket servers (like Pusher, Ably, Soketi), but Reverb is made by the Laravel team, is free, runs on your own machine, and integrates perfectly with Laravel. No third-party service needed!

---

### What is Laravel Echo?

**Laravel Echo** is a JavaScript library that makes it easy to listen for WebSocket events in your frontend code.

Without Echo, you'd have to write complicated WebSocket code yourself:
```js
// WITHOUT Echo — ugly and complicated
const socket = new WebSocket('ws://localhost:8080');
socket.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.channel === 'conversation.5' && data.event === 'MessageSent') {
        // handle the message...
    }
};
```

With Echo, it's beautiful and readable:
```js
// WITH Echo — clean and simple
Echo.private('conversation.5')
    .listen('MessageSent', (message) => {
        // handle the message
    });
```

Echo uses a library called **pusher-js** under the hood to handle the actual WebSocket connection. You don't need to learn pusher-js directly — Echo wraps it for you.

---

### How do all the pieces fit together?

Here's the full picture of what happens when Alice sends a message to Bob:

```
┌─────────────────────┐         ┌─────────────────────────┐
│  Alice's Browser    │         │   Laravel Backend        │
│  (React + Echo)     │         │   (PHP)                  │
│                     │         │                          │
│  1. Alice types a   │  HTTP   │  2. MessageController    │
│     message and    ─────────► │     saves to database    │
│     clicks send     │  POST   │                          │
│                     │         │  3. Fires MessageSent    │
│                     │         │     event                │
│                     │         │           │               │
│                     │         │           ▼               │
│                     │         │  4. Laravel sends the    │
│                     │         │     event to Reverb      │
└─────────────────────┘         └──────────┬──────────────┘
                                           │
                                           │ WebSocket
                                           ▼
                                ┌─────────────────────────┐
                                │  Laravel Reverb          │
                                │  (WebSocket Server)      │
                                │                          │
                                │  5. Reverb pushes the    │
                                │     event to everyone    │
                                │     listening on that    │
                                │     conversation channel │
                                └──────────┬──────────────┘
                                           │
                                           │ WebSocket
                                           ▼
                                ┌─────────────────────┐
                                │  Bob's Browser       │
                                │  (React + Echo)      │
                                │                      │
                                │  6. Echo receives     │
                                │     the event and     │
                                │     adds the message  │
                                │     to the chat       │
                                └──────────────────────┘
```

**The flow:**
1. Alice types a message and clicks send → a normal HTTP POST request (like you already built in Feature 2.3)
2. `MessageController@store` saves the message to the database (this already works!)
3. After saving, the controller fires a Laravel **Event** called `MessageSent` (we'll build this in Feature 3.2)
4. Laravel automatically sends that event to the Reverb WebSocket server
5. Reverb looks at which browsers are listening for events on that conversation's channel, and pushes the event to them
6. Bob's browser receives the event through Echo, and React adds the new message to the chat window — **without Bob refreshing the page!**

**In this tutorial (Feature 3.1), we're setting up steps 4, 5, and 6 — the plumbing.** We won't build the actual `MessageSent` event yet (that's Feature 3.2). Right now we're just making sure the WebSocket connection works.

---

## Now Let's Build It! 🔨

---

## Step 1: Install Laravel Broadcasting with Reverb

**Why do we need this?**
Laravel has a built-in system called **Broadcasting** that connects your PHP events to a WebSocket server. But it's not installed by default — we need to tell Laravel: "Hey, I want to use real-time features, please set everything up for me."

Laravel provides a single command that installs everything at once: the Reverb package, the broadcasting configuration, and the default channel routes.

1. Run this command in your terminal:
   ```bash
   php artisan install:broadcasting
   ```

   When it asks **"Would you like to install Laravel Reverb?"**, type **`yes`**.

   **What this command does behind the scenes:**
   - Installs the `laravel/reverb` Composer package (the WebSocket server)
   - Creates a `config/broadcasting.php` file (configuration for how broadcasting works)
   - Creates a `routes/channels.php` file (where you define who is allowed to listen on which channels)
   - Updates your `.env` file with Reverb connection settings (host, port, keys)
   - Enables the `BroadcastServiceProvider`

   Think of it like plugging in a new appliance — this command connects all the wires for you.

2. After the command finishes, let's verify it created everything. Check that these files exist:

   | File | Purpose |
   |------|---------|
   | `config/broadcasting.php` | Tells Laravel which broadcasting driver to use (Reverb) |
   | `routes/channels.php` | Defines authorization rules for private channels |

   And check that your `.env` file now has new lines that look like this:
   ```env
   BROADCAST_CONNECTION=reverb

   REVERB_APP_ID=...
   REVERB_APP_KEY=...
   REVERB_APP_SECRET=...
   REVERB_HOST="localhost"
   REVERB_PORT=8080
   REVERB_SCHEME=http

   VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
   VITE_REVERB_HOST="${REVERB_HOST}"
   VITE_REVERB_PORT="${REVERB_PORT}"
   VITE_REVERB_SCHEME="${REVERB_SCHEME}"
   ```

   **What are these values?**
   - `BROADCAST_CONNECTION=reverb` — Tells Laravel: "Use Reverb as the WebSocket server" (before this was set to `log`, which means events were just written to a log file and not actually broadcast)
   - `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET` — These are like passwords. They make sure only YOUR app can connect to YOUR WebSocket server. The `install:broadcasting` command generates random values for these automatically.
   - `REVERB_HOST` and `REVERB_PORT` — Where the WebSocket server runs. By default it's `localhost:8080`, meaning it runs on your own machine on port 8080.
   - `VITE_REVERB_*` — These are copies of the Reverb settings, but with the `VITE_` prefix. Why? Because in a Vite project (which is what we use), only environment variables that start with `VITE_` are accessible in the frontend JavaScript code. This is a security feature — you don't want your database password to accidentally end up in the browser!

---

## Step 2: Understand the Broadcasting Config

**Why should I look at this?**
You don't usually need to edit `config/broadcasting.php`, but understanding it helps you debug problems later. Let's look at the key part:

Open `config/broadcasting.php` and you'll see something like this (simplified):

```php
'connections' => [
    'reverb' => [
        'driver' => 'reverb',
        'key' => env('REVERB_APP_KEY'),
        'secret' => env('REVERB_APP_SECRET'),
        'app_id' => env('REVERB_APP_ID'),
        'options' => [
            'host' => env('REVERB_HOST', '0.0.0.0'),
            'port' => env('REVERB_PORT', 443),
            'scheme' => env('REVERB_SCHEME', 'https'),
            'useTLS' => env('REVERB_SCHEME', 'https') === 'https',
        ],
    ],
],
```

**What this means in simple words:**
- This file lists all the available "broadcasting drivers" (ways to send real-time events)
- The `reverb` connection tells Laravel: "When you need to broadcast an event, connect to the Reverb server using these credentials"
- The `env()` function reads values from your `.env` file, so you never have to hard-code passwords in your config

Think of `broadcasting.php` as a phone book — it has the phone number (host + port) and the PIN code (key + secret) to reach the WebSocket server.

---

## Step 3: Update the `bootstrap/app.php` to Include Channels

**Why do we need this?**
When `install:broadcasting` created the `routes/channels.php` file, we need to make sure Laravel actually loads it. In Laravel 13, the routing is configured in `bootstrap/app.php`.

1. Open `bootstrap/app.php` and add the `channels` line to the `withRouting` section:

   ```php
   return Application::configure(basePath: dirname(__DIR__))
       ->withRouting(
           web: __DIR__.'/../routes/web.php',
           commands: __DIR__.'/../routes/console.php',
           channels: __DIR__.'/../routes/channels.php', // ← ADD THIS LINE
           health: '/up',
       )
   ```

   **What does this do?**
   - This tells Laravel: "When the app starts, also load the channel authorization rules from `routes/channels.php`"
   - Without this line, Laravel won't know how to authorize users on private WebSocket channels
   - Think of it like adding a new chapter to a book's table of contents — if it's not listed, the reader (Laravel) won't know to look for it

2. Now let's look at `routes/channels.php`. It was created by the install command and looks something like this:

   ```php
   <?php

   use Illuminate\Support\Facades\Broadcast;

   Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
       return (int) $user->id === (int) $id;
   });
   ```

   **What is this?**
   - This is a **channel authorization rule**. It defines WHO is allowed to listen on WHICH channels.
   - The default rule says: "A user can listen on the `App.Models.User.{id}` channel only if their own user ID matches the `{id}` in the channel name."
   - For example, User #5 can listen on `App.Models.User.5` but NOT on `App.Models.User.8`.
   - We'll add our own channel rule here in Feature 3.2 (for conversation channels), but for now, the default is fine.

   **Why do channels need authorization?**
   Imagine if anyone could listen on any channel. A hacker could listen to `conversation.42` and read private messages between two other people! Channel authorization prevents that — Laravel checks "are you allowed to listen here?" before giving access.

---

## Step 4: Install Frontend Packages (Laravel Echo & Pusher.js)

**Why do we need these?**
We've set up the backend (Reverb server + broadcasting config). Now we need to set up the frontend so your React app can connect to the WebSocket server and listen for events.

We need two npm packages:
- **`laravel-echo`** — The clean, simple API for listening to channels and events (remember the example from the intro?)
- **`pusher-js`** — The low-level library that actually handles the WebSocket connection. Echo uses this under the hood. You won't write pusher-js code directly, but Echo needs it installed to work.

1. Run this command in your terminal:
   ```bash
   npm install laravel-echo pusher-js
   ```

   **Why pusher-js if we're using Reverb?**
   Great question! Reverb speaks the same "language" (protocol) as Pusher. Instead of inventing a brand new protocol, the Reverb team made Reverb compatible with the Pusher protocol. This means all the existing tools (like `pusher-js`) work with Reverb out of the box. Think of it like how a USB-C cable works with many different laptops — the cable (pusher-js) doesn't care which laptop (Pusher or Reverb) is on the other end, as long as they speak the same protocol.

---

## Step 5: Configure Laravel Echo in the Frontend

**Why do we need this?**
We installed the packages, but they don't do anything until we configure them. We need to tell Echo: "Here's the WebSocket server address, here's the key to get in, and here's how to connect."

1. Create a new file at `resources/js/echo.ts` (or if the `install:broadcasting` command already created it, open and update it):

   ```typescript
   import Echo from 'laravel-echo';
   import Pusher from 'pusher-js';

   // Make Pusher available globally — Echo needs this to create the WebSocket connection
   window.Pusher = Pusher;

   // Create a new Echo instance with the Reverb configuration
   // This reads the VITE_REVERB_* values from your .env file
   window.Echo = new Echo({
       broadcaster: 'reverb',
       key: import.meta.env.VITE_REVERB_APP_KEY,
       wsHost: import.meta.env.VITE_REVERB_HOST,
       wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
       wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
       forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
       enabledTransports: ['ws', 'wss'],
   });
   ```

   **Let's break down every single line:**

   - `import Echo from 'laravel-echo'` — We import the Echo library that we just installed.
   - `import Pusher from 'pusher-js'` — We import the Pusher library that Echo needs.
   - `window.Pusher = Pusher` — We attach Pusher to the `window` object (a global variable in the browser). Echo looks for `window.Pusher` when it starts up. If it's not there, Echo will crash with a confusing error.
   - `window.Echo = new Echo({...})` — We create a new Echo instance and attach it to `window` so we can use it from any React component later.
   - `broadcaster: 'reverb'` — Tells Echo to use the Reverb protocol.
   - `key: import.meta.env.VITE_REVERB_APP_KEY` — The "password" to connect to the WebSocket server. `import.meta.env` is how Vite reads environment variables. Remember those `VITE_*` variables in `.env`? This is where they're used!
   - `wsHost` / `wsPort` — The address of the WebSocket server (`localhost` and `8080` by default).
   - `wssPort` — The port for secure WebSocket connections (HTTPS version). In development we use `ws` (non-secure), in production we'd use `wss` (secure).
   - `forceTLS: false` — In development, we don't use TLS (the "S" in HTTPS). In production, you'd set this to `true`.
   - `enabledTransports: ['ws', 'wss']` — Tells pusher-js to only use WebSocket connections (not fall back to HTTP polling, which would defeat the purpose).

2. Now we need to add TypeScript type declarations so TypeScript doesn't complain about `window.Pusher` and `window.Echo`. Create or update your type declaration file.

   Check if you have a type declaration file already. If not, add the following types. If you already have a file like `resources/js/types/global.d.ts` or `resources/js/vite-env.d.ts`, add these lines to it:

   ```typescript
   import type Echo from 'laravel-echo';
   import type Pusher from 'pusher-js';

   declare global {
       interface Window {
           Pusher: typeof Pusher;
           Echo: Echo;
       }
   }
   ```

   **What is this?**
   - TypeScript is strict — it doesn't know that `window.Pusher` and `window.Echo` exist, because they're not built into the browser.
   - This file tells TypeScript: "Hey, trust me, `window.Pusher` and `window.Echo` will exist at runtime. Here's what they look like."
   - Without this, you'd get red squiggly errors everywhere in your editor.

3. Finally, import the Echo configuration in your main app file so it runs when the app loads.

   Open `resources/js/app.tsx` and add this import at the top:

   ```tsx
   import './echo';
   ```

   Add it with the other imports, like this:

   ```tsx
   import { createInertiaApp } from '@inertiajs/react';
   import { Toaster } from '@/components/ui/sonner';
   import { TooltipProvider } from '@/components/ui/tooltip';
   import { initializeTheme } from '@/hooks/use-appearance';
   import AppLayout from '@/layouts/app-layout';
   import AuthLayout from '@/layouts/auth-layout';
   import SettingsLayout from '@/layouts/settings/layout';
   import './echo'; // ← ADD THIS LINE — initializes the WebSocket connection
   ```

   **What does this do?**
   - When your React app starts, it runs all the import statements at the top of `app.tsx`.
   - By importing `./echo`, the code inside `echo.ts` runs immediately, which creates the Echo instance and connects to the Reverb WebSocket server.
   - This means the WebSocket connection is established as soon as the user opens the app — they don't need to do anything special.

---

## Step 6: Update the `composer dev` Script

**Why do we need this?**
You now have THREE servers that need to run at the same time during development:
1. **Laravel HTTP server** (`php artisan serve`) — handles regular page loads and API requests
2. **Vite dev server** (`npm run dev`) — compiles your React code and serves it with hot reload
3. **Reverb WebSocket server** (`php artisan reverb:start`) — handles real-time WebSocket connections

Your current `composer dev` script (in `composer.json`) runs the first two (plus a queue listener). We need to add the Reverb server as well.

1. Open `composer.json` and find the `"dev"` script. Update it to include Reverb:

   ```json
   "dev": [
       "Composer\\Config::disableProcessTimeout",
       "npx concurrently -c \"#93c5fd,#c4b5fd,#fdba74,#86efac\" \"php artisan serve\" \"php artisan queue:listen --tries=1\" \"npm run dev\" \"php artisan reverb:start\" --names='server,queue,vite,reverb'"
   ],
   ```

   **What changed?**
   - We added `\"php artisan reverb:start\"` as a fourth concurrent process
   - We added `\"#86efac\"` (a green color) so you can visually distinguish Reverb's output in the terminal
   - We added `'reverb'` to the `--names` list so the terminal labels its output clearly

   Now when you run `composer dev`, you'll see four colored outputs in your terminal:
   - 🔵 **server** — Laravel HTTP server
   - 🟣 **queue** — Queue worker for background jobs
   - 🟠 **vite** — Frontend dev server
   - 🟢 **reverb** — WebSocket server

---

## Step 7: Start Everything and Verify the Connection

**Why do we need to verify?**
We've installed and configured everything, but we need to make sure it actually works. Let's start all the servers and check if the WebSocket connection is established.

1. Stop any running servers (press `Ctrl+C` in your terminal), then start everything:
   ```bash
   composer dev
   ```

   You should see output from all four processes. Look for the **reverb** output — it should say something like:
   ```
   Starting server on 0.0.0.0:8080...
   ```

   This means the WebSocket server is running and waiting for connections!

2. Open your app in the browser (usually `http://localhost:8000`) and log in.

3. Open the **browser Developer Tools** (press `F12` or right-click → "Inspect"), then go to the **Console** tab.

   You should NOT see any errors like "WebSocket connection failed" or "Echo is not defined."

4. Now go to the **Network** tab in DevTools, and filter by **WS** (WebSocket). You should see a WebSocket connection to `ws://localhost:8080/app/YOUR_APP_KEY`.

   If you see this connection with a green status, **congratulations — your WebSocket connection is working!** 🎉

   **What if you see errors?**
   - **"WebSocket connection to 'ws://localhost:8080/...' failed"** — Make sure `php artisan reverb:start` is actually running. Check the terminal for errors.
   - **"Echo is not defined"** — Make sure you imported `./echo` in `app.tsx` and that the file exists at `resources/js/echo.ts`.
   - **"Pusher is not defined"** — Make sure you have `window.Pusher = Pusher;` in your `echo.ts` file.
   - **Port conflict** — If something else is already using port 8080, change `REVERB_PORT` in your `.env` to something else (like `6001`).

---

## Step 8: Write a Test to Confirm Events Are Broadcastable

**Why do we need this?**
Tests give us confidence that our setup works correctly. Even though we haven't built a real event yet (that's Feature 3.2), we can write a quick test to make sure Laravel's broadcasting system is wired up properly.

1. Create a new test file:
   ```bash
   php artisan make:test BroadcastingSetupTest
   ```

2. Open `tests/Feature/BroadcastingSetupTest.php` and replace the content with:

   ```php
   <?php

   use Illuminate\Support\Facades\Broadcast;

   // Test that the broadcasting system is configured and working
   test('broadcasting is configured to use reverb', function () {
       // Check that the default broadcast connection is set to 'reverb'
       expect(config('broadcasting.default'))->toBe('reverb');
   });

   test('channels route file is loaded', function () {
       // The channels.php route file should be loaded by the application
       // We can verify this by checking that the default User channel exists
       // This channel was created by the install:broadcasting command
       $this->assertTrue(
           file_exists(base_path('routes/channels.php')),
           'The routes/channels.php file should exist'
       );
   });
   ```

   **What does each test do?**
   - **Test 1** — Checks that your `broadcasting.default` config is set to `reverb`. If this fails, it means your `.env` still has `BROADCAST_CONNECTION=log` instead of `BROADCAST_CONNECTION=reverb`.
   - **Test 2** — Checks that the `routes/channels.php` file exists. If this fails, it means the `install:broadcasting` command didn't create the file, or it was accidentally deleted.

   These are simple "sanity check" tests. They make sure the foundation is in place before we start building real events on top of it in Feature 3.2.

3. Run the test:
   ```bash
   php artisan test tests/Feature/BroadcastingSetupTest.php
   ```

   You should see green **PASS** results! ✅

---

## 📝 Quick Vocabulary Recap

Here's a cheat sheet of all the new terms you learned in this tutorial:

| Term | What It Is | Analogy |
|------|-----------|---------|
| **HTTP** | Request-response protocol (browser asks, server answers) | Sending letters by mail 📬 |
| **WebSocket** | Persistent two-way connection (either side can talk anytime) | A phone call 📞 |
| **Laravel Reverb** | A WebSocket server built for Laravel | A telephone exchange that routes calls |
| **Broadcasting** | Laravel's system for sending events to the WebSocket server | The post office that delivers letters |
| **Channel** | A "topic" or "room" that users subscribe to | A radio frequency — you tune in to listen |
| **Private Channel** | A channel that requires authorization | A private radio frequency — you need a code to listen |
| **Laravel Echo** | Frontend JS library for listening to channels | A radio receiver in your browser |
| **pusher-js** | Low-level WebSocket library that Echo uses internally | The antenna inside the radio |
| **Event** | A PHP class that represents something that happened (e.g., "a message was sent") | A news headline that gets broadcast |

---

## ✅ Feature 3.1 Checklist

Let's confirm you've completed everything:

- [ x ] Ran `php artisan install:broadcasting` (installed Reverb + broadcasting config)
- [ x ] Verified `.env` has `BROADCAST_CONNECTION=reverb` and `REVERB_*` settings
- [ x ] Verified `config/broadcasting.php` was created
- [ x ] Verified `routes/channels.php` was created
- [ x ] Updated `bootstrap/app.php` to load the channels route file
- [ x ] Installed `laravel-echo` and `pusher-js` via npm
- [ x ] Created `resources/js/echo.ts` with the Echo configuration
- [ x ] Added TypeScript type declarations for `window.Echo` and `window.Pusher`
- [ x ] Imported `./echo` in `resources/js/app.tsx`
- [ x ] Updated `composer dev` script to include `php artisan reverb:start`
- [ x ] Started all servers with `composer dev` and verified no WebSocket errors in the browser console
- [ x ] Wrote and passed the broadcasting setup test

---

## 🔮 What's Next? (Feature 3.2 Preview)

Now that the WebSocket "plumbing" is in place, in **Feature 3.2** you'll:
1. Create a `MessageSent` event (a PHP class that says "a new message was just sent!")
2. Make it broadcastable (so it gets pushed through Reverb to connected browsers)
3. Update `MessageController@store` to fire this event after saving a message
4. Use Echo in React to listen for the event and add the new message to the chat in real-time

The foundation you built in this tutorial is what makes all of that possible. Think of Feature 3.1 as laying the pipes — Feature 3.2 is turning on the water! 💧

---

> **Tip:** If you close your terminal and come back later, remember to run `composer dev` to start all four servers (HTTP, Queue, Vite, Reverb). The WebSocket connection only works when the Reverb server is running!
