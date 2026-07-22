# Syncora — Feature Plan & Learning Roadmap

This is your master plan for building a WhatsApp-like real-time messaging app. The goal is to learn **WebSockets**, **Redis**, **Queues**, **Auth Depth**, and **Testing Discipline** by turning the static UI in `Home.tsx` into a fully working application.

Each feature has a checkbox so you can track your progress. Simple words are used so everything is easy to understand.

---

## Phase 1: Database & Data Foundation

*Before anything works, we need tables in the database to store conversations and messages.*

---

### Feature 1.1 — Messages Table & Model

- [ x ] Create the `messages` migration table
- [ x ] Create the `Message` model
- [ x ] Set up relationships (a message belongs to a sender and a receiver)
- [ x ] Write a Pest test to check the relationship works

**What is this?**
Right now the messages in `Home.tsx` are fake data hard-coded at the top of the file. We need a real database table to store who sent what message, to whom, and when.

**How to build it:**
1. Run `php artisan make:model Message -m` to create the model and migration at the same time.
2. Inside the migration, add these columns: `id`, `sender_id` (the user who sent the message), `receiver_id` (the user who receives it), `body` (the actual text), `is_read` (true/false if the receiver already read it), and `timestamps`.
3. Inside the `Message` model, create two relationships: `sender()` which belongs to a `User`, and `receiver()` which also belongs to a `User`.
4. Inside the `User` model, add a `sentMessages()` and `receivedMessages()` relationship.

**Test to write:**
Create a Pest test that makes two users, creates a message from User A to User B, then checks that `$message->sender->id` equals User A's id.

---

### Feature 1.2 — Conversations Table & Model

- [ x ] Create the `conversations` migration table
- [ x ] Create the `Conversation` model
- [ x ] Link conversations to users (many-to-many with a pivot table)
- [ x ] Link messages to a conversation
- [ x ] Write a Pest test to verify conversation-user relationship

**What is this?**
The left sidebar in the UI shows a list of people you are chatting with. Each of those is a "conversation." A conversation connects two (or more) users together and holds all their messages.

**How to build it:**
1. Run `php artisan make:model Conversation -m` to create the model and migration.
2. Create a pivot table migration called `conversation_user` with columns: `conversation_id` and `user_id`.
3. Inside the `Conversation` model, add a `users()` many-to-many relationship and a `messages()` has-many relationship.
4. Update the `messages` table to include a `conversation_id` column.

**Test to write:**
Create two users and a conversation linking them. Assert that the conversation has exactly 2 users, and both users can access the conversation.

---

## Phase 2: Making the UI Real (Controllers & API)

*Replace the fake data in `Home.tsx` with real data coming from the backend.*

---

### Feature 2.1 — Load Real Conversations in the Sidebar

- [ x ] Create a `ConversationController`
- [ x ] Query conversations for the logged-in user
- [ x ] Pass data from the controller to the React page via Inertia
- [ x ] Replace the hard-coded `conversations` array in `Home.tsx` with real props
- [ x ] Write a Pest test for the controller

**What is this?**
Right now the left column shows fake names like "Alice Nguyen" and "Bob Martinez." We need to replace those with real conversations from the database.

**How to build it:**
1. Create a controller: `php artisan make:controller ConversationController`.
2. In the controller, query conversations where the logged-in user is a participant. Include the last message and unread count.
3. Update `routes/web.php` to use this controller instead of `Route::inertia()`.
4. In `Home.tsx`, receive the conversations as a prop and use them instead of the hard-coded array.

**Test to write:**
Create a Pest test that logs in a user, calls the route, and asserts that the Inertia response contains the correct conversations.

---

### Feature 2.2 — Load Real Messages in the Chat Window

- [ x ] Create a `MessageController`
- [ x ] Fetch messages for the selected conversation
- [ x ] Display real messages in the right column of `Home.tsx`
- [ x ] Write a Pest test for loading messages

**What is this?**
When you click on a conversation in the left sidebar, the right side should show all the messages between you and that person. Right now it shows fake messages.

**How to build it:**
1. Create a controller: `php artisan make:controller MessageController`.
2. Add a route that accepts a `conversation_id` and returns all messages inside it.
3. In React, when you click a conversation, fetch the messages for that conversation and display them.

**Test to write:**
Create two users, a conversation, and some messages. Log in as User A, request the messages for that conversation, and assert the correct messages are returned.

---

### Feature 2.3 — Send a Message

- [ x ] Create a `store` method in `MessageController`
- [ x ] Validate the message input on the backend
- [ x ] Save the message to the database
- [ x ] Return the new message to the frontend
- [ x ] Make the send button in `Home.tsx` actually work
- [ x ] Write a Pest test for sending a message

**What is this?**
The input box at the bottom of the chat window has a send button. When you type a message and press send, it should save to the database and appear in the chat.

**How to build it:**
1. In `MessageController`, add a `store()` method that receives the message text and conversation ID.
2. Validate that the message is not empty and that the user belongs to the conversation.
3. Save the message to the database with `sender_id` set to the logged-in user.
4. In React, use an Inertia form to submit the message and update the chat window.

**Test to write:**
Log in as a user, send a POST request with a message body, and assert the message now exists in the database.

---

### Feature 2.4 — Search Conversations

- [ x ] Make the search button on the left sidebar functional
- [ x ] Filter conversations by name as the user types
- [ x ] Write a Pest test for the search endpoint

**What is this?**
There is a search icon (🔍) at the top of the left sidebar. When clicked, it should show a search box where you can type a name and filter the conversation list.

**How to build it:**
1. Add a search input that appears when the search icon is clicked.
2. Filter conversations on the frontend as the user types (client-side filtering is fine for now).
3. Optionally, add a backend search endpoint for when the user has many conversations.

**Test to write:**
Create multiple conversations, search for a specific name, and assert only the matching conversations are returned.

---

### Feature 2.5 — Start a New Conversation

- [ x ] Create a `store` method in `ConversationController`
- [ x ] Add a backend endpoint to search for users by email or name
- [ x ] Add a "New Chat" button to the left sidebar
- [ x ] Build a modal/popup where the user can search for another user by email
- [ x ] When the user selects someone, create a new conversation (or open the existing one)
- [ x ] Redirect to the new conversation and load it in the chat window
- [ x ] Prevent duplicate conversations between the same two users
- [ x ] Write a Pest test for creating a conversation
- [ x ] Write a Pest test for the user search endpoint
- [ x ] Write a Pest test to verify duplicate conversations are not created

**What is this?**
Right now, conversations only exist if they were put into the database manually (via seeders). There is no way for a real user to start chatting with someone new. This feature adds a "New Chat" button to the sidebar. When you click it, a popup appears where you can search for a user by their email address. If you find them, a new conversation is created and you can start messaging right away.

**How to build it:**

*Backend:*
1. Create a `UserSearchController` (or add a method to an existing controller) that accepts a search query and returns matching users from the database. Only search by `email` or `name`, and exclude the currently logged-in user from the results.
2. In `ConversationController`, add a `store()` method that receives the other user's ID. Before creating a new conversation, check if a conversation between these two users already exists. If it does, return the existing one. If not, create a new conversation and attach both users to it.
3. Add two new routes:
   - `GET /users/search?query=...` — for searching users
   - `POST /conversations` — for creating a new conversation

*Frontend:*
4. Add a "New Chat" button (a `+` icon or a compose icon) next to the search icon on the left sidebar top bar.
5. When clicked, show a modal/popup with a search input.
6. As the user types an email, send a request to the search endpoint and display matching users.
7. When the user clicks on a result, send a POST request to create the conversation.
8. After the conversation is created, add it to the sidebar list, select it, and open the chat window.

**Tests to write:**
1. Search for a user by email and assert the correct user is returned.
2. Search should NOT return the logged-in user themselves.
3. Create a new conversation between two users and assert it exists in the database with both users attached.
4. Try to create a conversation with a user that already has one — assert no duplicate is created and the existing conversation is returned.

---

### Feature 2.6 — Chat Request & Accept Notifications

- [ x ] Create a `chat_requests` table (sender_id, receiver_id, status: pending/accepted/rejected)
- [ x ] Create a `ChatRequest` model with relationships
- [ x ] Create a `ChatRequestController` with `store`, `accept`, and `reject` methods
- [ x ] Add routes for sending, accepting, and rejecting chat requests
- [ x ] Add a notification bell icon in the header (next to the dark/light mode toggle)
- [ x ] Show a badge count on the bell icon for pending requests
- [ x ] When the bell is clicked, show a dropdown listing pending chat requests
- [ x ] Each request shows the sender's name/email and Accept/Reject buttons
- [ x ] When accepted, create the conversation and add both users to it
- [ x] When rejected, mark the request as rejected
- [ x ] Prevent duplicate chat requests (can't send a request to someone you already requested)
- [ x ] Update Feature 2.5 flow: instead of creating a conversation immediately, send a chat request first
- [ x ] Write a Pest test for sending a chat request
- [ x ] Write a Pest test for accepting a chat request (conversation is created)
- [ x ] Write a Pest test for rejecting a chat request
- [ x ] Write a Pest test for preventing duplicate requests

**What is this?**
In Feature 2.5, when you search for a user and click on them, a conversation is created immediately. But in real life, you wouldn't want random strangers to just start chatting with you. This feature adds a **chat request system** — like a friend request. When User A wants to chat with User B, a request is sent. User B sees a notification bell icon in the header with a badge (like "2" for 2 pending requests). When they click the bell, they see who wants to chat and can Accept or Reject. If they accept, the conversation is created and both users can start chatting.

**How to build it:**

*Database:*
1. Create a `chat_requests` migration with columns: `id`, `sender_id` (foreign key to users), `receiver_id` (foreign key to users), `status` (enum: pending, accepted, rejected), and `timestamps`.
2. Create a `ChatRequest` model with `sender()` and `receiver()` BelongsTo relationships.

*Backend:*
3. Create a `ChatRequestController` with three methods:
   - `store()` — Receives the receiver's user ID, validates the request (no duplicate, can't send to yourself), and creates a pending chat request.
   - `accept()` — Changes the request status to "accepted" and creates a new conversation with both users attached.
   - `reject()` — Changes the request status to "rejected".
4. Add a route or method to fetch all pending chat requests for the logged-in user (for the notification dropdown).
5. Add routes:
   - `POST /chat-requests` — send a request
   - `PATCH /chat-requests/{chatRequest}/accept` — accept a request
   - `PATCH /chat-requests/{chatRequest}/reject` — reject a request
   - `GET /chat-requests/pending` — fetch pending requests for the bell icon

*Frontend:*
6. Add a notification bell icon (🔔) in the header next to the dark/light mode toggle.
7. Show a red badge with a count of pending requests on the bell icon.
8. When clicked, show a dropdown panel listing each pending request with the sender's name and Accept/Reject buttons.
9. Update Feature 2.5: instead of creating a conversation on user search click, send a chat request instead.

**Tests to write:**
1. Send a chat request and assert it exists in the `chat_requests` table with status "pending".
2. Accept a chat request and assert a conversation is created with both users attached and the request status is "accepted".
3. Reject a chat request and assert the request status is "rejected" and no conversation is created.
4. Try to send a duplicate request and assert it is rejected.
5. Try to send a request to yourself and assert it is rejected.

---

## Phase 3: Real-Time with WebSockets & Redis

*This is where you learn WebSockets and Redis. Messages will appear instantly without refreshing the page.*

---

### Feature 3.1 — Set Up Laravel Reverb (WebSocket Server)

- [ x ] Install Laravel Reverb
- [ x ] Configure the `.env` file with Reverb settings
- [ x ] Install Laravel Echo on the frontend
- [ x ] Verify the WebSocket connection works in the browser console
- [ x ] Write a test to confirm events are broadcastable

**What is this?**
Laravel Reverb is a WebSocket server built for Laravel. It allows your app to push data to the browser instantly (without the user needing to refresh). Think of it like a phone call — the connection stays open so both sides can talk in real-time.

**How to build it:**
1. Run `php artisan install:broadcasting` to install Reverb.
2. Update your `.env` file with the Reverb host, port, and keys.
3. Install `laravel-echo` and `pusher-js` on the frontend: `npm install laravel-echo pusher-js`.
4. Configure Echo in your `resources/js/bootstrap.ts` file.
5. Start the WebSocket server with `php artisan reverb:start`.

---

### Feature 3.2 — Real-Time Message Delivery

- [ x ] Create a `MessageSent` event
- [ x ] Make the event implement `ShouldBroadcast`
- [ x ] Fire the event when a message is saved
- [ x ] Listen for the event in React using Laravel Echo
- [ x ] New messages appear instantly on the other user's screen
- [ x ] Write a Pest test to verify the event is dispatched

**What is this?**
When User A sends a message, it should pop up on User B's screen immediately — without User B refreshing the page. This is the core of real-time messaging.

**How to build it:**
1. Run `php artisan make:event MessageSent`.
2. Make the event implement `ShouldBroadcast` and broadcast on a private channel like `conversation.{id}`.
3. In `MessageController@store`, after saving the message, fire `event(new MessageSent($message))`.
4. In React, use `Echo.private('conversation.' + id).listen('MessageSent', callback)` to receive the message and add it to the chat.

**Test to write:**
Use `Event::fake()` in Pest, send a message, and assert that `MessageSent` was dispatched with the correct data.

---

### Feature 3.3 — Online/Offline Status (Presence Channels)

- [ x ] Set up a Presence Channel
- [ x ] Track which users are online using Redis
- [ x ] Update the green dot on the avatar in real-time
- [ x ] Write a test for user presence

**What is this?**
The UI shows a green dot on avatars to indicate if a user is online. Right now it is fake. We need to detect when users are actually connected and update the dot dynamically.

**How to build it:**
1. Set up **Redis** as your broadcast and cache driver in `.env`.
2. Create a Presence Channel (e.g., `presence-chat`) that users join when they open the app.
3. Laravel Echo provides `here()`, `joining()`, and `leaving()` callbacks. Use them to track who is online.
4. Update the Avatar component to reflect real online status.

**Test to write:**
Verify that when a user authenticates on the presence channel, the correct user data is returned.

---

### Feature 3.4 — "Typing..." Indicator

- [ x ] Detect when a user is typing in the input box
- [ x ] Broadcast a whisper event (client-side only, no server save)
- [ x ] Show "typing..." text below the user's name in the chat header
- [ x ] Hide the indicator after 2 seconds of no typing
- [ x ] Write a test to confirm typing events are NOT saved to the database

**What is this?**
When Alice is typing a message to you, you should see "Alice is typing..." appear in the chat window. This is a real-time feature powered by WebSockets.

**How to build it:**
1. In React, listen to `keydown` events on the message input.
2. Use Echo's `.whisper('typing', { user: currentUser })` to send a client-only event (no server involved).
3. On the receiving end, listen with `.listenForWhisper('typing', callback)` and show the indicator.
4. Use a `setTimeout` to hide the indicator after 2 seconds of silence.

**Test to write:**
Verify that typing events do NOT create any records in the database (they should only exist in memory).

---

## Phase 4: Background Jobs & Queues

*Learn how to run slow tasks in the background so the app stays fast.*

---

### Feature 4.1 — Email Notification for Offline Users

- [ ] Set up Laravel Queues (use `database` or `redis` driver)
- [ ] Create a `SendMessageNotification` job
- [ ] Dispatch the job when a message is sent to an offline user
- [ ] The job sends an email saying "You have a new message from [Name]"
- [ ] Write a Pest test using `Queue::fake()` to verify the job is dispatched

**What is this?**
If User B is offline and User A sends them a message, we want to send User B an email notification. But sending emails is slow (1-3 seconds), so we don't want the sender to wait. Instead, we push the email task to a background queue.

**How to build it:**
1. Configure your queue driver in `.env` (set `QUEUE_CONNECTION=database` or `redis`).
2. Run `php artisan queue:table && php artisan migrate` (if using database driver).
3. Create the job: `php artisan make:job SendMessageNotification`.
4. Inside the job, send a Laravel notification or mail to the offline user.
5. In `MessageController@store`, check if the receiver is offline. If yes, dispatch the job: `SendMessageNotification::dispatch($message)`.
6. Run the queue worker: `php artisan queue:work`.

**Test to write:**
Use `Queue::fake()` in Pest, send a message to an offline user, and assert `SendMessageNotification` was pushed to the queue.

---

### Feature 4.2 — Mark Messages as Read

- [ ] When a user opens a conversation, mark all unread messages as read
- [ ] Update the unread badge count on the sidebar in real-time
- [ ] Queue a `MarkMessagesRead` job for batch updates
- [ ] Write a Pest test for the read status update

**What is this?**
The UI shows a red badge with a number (like "2" or "5") on conversations that have unread messages. When the user opens that conversation, those messages should be marked as read and the badge should disappear.

**How to build it:**
1. When a user clicks on a conversation, send a request to the backend to mark all messages in that conversation as `is_read = true`.
2. Broadcast a `MessagesRead` event so the sender knows their messages were seen.
3. Update the sidebar badge count in real-time.

**Test to write:**
Create unread messages, open the conversation, and assert all messages now have `is_read = true`.

---

### Feature 4.3 — File & Image Attachments

- [ ] Add an attachment button to the message input bar
- [ ] Upload files to Laravel storage
- [ ] Queue a job to compress/resize images in the background
- [ ] Display image previews in the chat bubble
- [ ] Write a Pest test for file upload validation

**What is this?**
Allow users to send images and files in the chat. Since image processing (resizing, compressing) is slow, we use a queue job to handle it in the background.

**How to build it:**
1. Add a file input button next to the message text input.
2. Upload the file to `storage/app/attachments`.
3. Save the file path in the `messages` table (add an `attachment_path` column).
4. Create a job `ProcessAttachment` that compresses the image.
5. Display the image inside the message bubble.

**Test to write:**
Upload a fake image file, assert it exists in storage, and assert the compression job was dispatched.

---

## Phase 5: Auth Depth & Security

*Go deeper into authentication — who can see what, and how to protect private conversations.*

---

### Feature 5.1 — Private Channel Authorization

- [ ] Define authorization rules for private WebSocket channels
- [ ] Only allow users who belong to a conversation to listen on its channel
- [ ] Write a Pest test to verify unauthorized users are blocked

**What is this?**
Right now, if someone knows the conversation ID, they could potentially listen to messages that aren't theirs. We need to add authorization rules so only participants of a conversation can access its WebSocket channel.

**How to build it:**
1. In `routes/channels.php`, define a rule for `conversation.{id}` that checks if the authenticated user is a participant.
2. Return `true` only if the user belongs to the conversation, otherwise return `false`.

**Test to write:**
Try to authorize a user on a conversation they don't belong to and assert it returns `false`.

---

### Feature 5.2 — Block & Unblock Users

- [ ] Create a `blocked_users` pivot table
- [ ] Add block/unblock functionality through the "More Options" (three dot) button
- [ ] Prevent blocked users from sending messages
- [ ] Write a Pest test to verify blocked users cannot send messages

**What is this?**
The three-dot button (⋯) on the left sidebar and the info button (ℹ) on the chat header should allow users to block someone. Blocked users should not be able to send messages to the person who blocked them.

**How to build it:**
1. Create a `blocked_users` table with `blocker_id` and `blocked_id`.
2. In `MessageController@store`, check if the sender is blocked by the receiver. If yes, return an error.
3. Add UI buttons for blocking and unblocking through the options menu.

**Test to write:**
Block a user, try to send a message from the blocked user, and assert the message is rejected.

---

### Feature 5.3 — Delete Messages & Conversations

- [ ] Allow users to delete individual messages
- [ ] Allow users to delete entire conversations
- [ ] Use soft deletes so data can be recovered if needed
- [ ] Write Pest tests for delete operations

**What is this?**
Users should be able to delete messages they sent or entire conversations. We use "soft deletes" which means the data is hidden but not permanently removed from the database.

**How to build it:**
1. Add `SoftDeletes` trait to the `Message` and `Conversation` models.
2. Create delete endpoints in the controllers.
3. On the frontend, add a right-click or long-press option to delete messages.

**Test to write:**
Delete a message, assert it no longer appears in queries, but still exists in the database with a `deleted_at` timestamp.

---

## Phase 6: Testing Discipline

*Build confidence in your code by writing tests for every feature.*

---

### Feature 6.1 — Unit Tests for Models

- [ ] Test `Message` model relationships (sender, receiver, conversation)
- [ ] Test `Conversation` model relationships (users, messages)
- [ ] Test `User` model relationships (sentMessages, receivedMessages)

**What is this?**
Unit tests check that your models and their relationships work correctly in isolation. They are fast and catch bugs early.

---

### Feature 6.2 — Feature Tests for Controllers

- [ ] Test `ConversationController` — loading conversations
- [ ] Test `MessageController` — sending, loading, and deleting messages
- [ ] Test authorization — users cannot access conversations they don't belong to

**What is this?**
Feature tests simulate a real user making HTTP requests to your app. They test the full flow from request to response.

---

### Feature 6.3 — Event & Queue Tests

- [ ] Test that `MessageSent` event is fired when a message is saved
- [ ] Test that `SendMessageNotification` job is dispatched for offline users
- [ ] Test that `ProcessAttachment` job is dispatched for image uploads

**What is this?**
These tests use Laravel's `Event::fake()` and `Queue::fake()` to verify that events and jobs are triggered correctly without actually broadcasting or processing them.

---

### Feature 6.4 — Full End-to-End Flow Test

- [ ] Create two users
- [ ] Create a conversation between them
- [ ] User A sends a message
- [ ] Assert message is in the database
- [ ] Assert `MessageSent` event was fired
- [ ] Assert notification job was queued (if User B is offline)
- [ ] User B opens the conversation
- [ ] Assert messages are marked as read

**What is this?**
This is the "big boss" test. It runs through the entire application flow from start to finish to make sure everything works together. If this test passes, you can be confident your app is solid.

---

## Summary Table

| Phase | What You Learn | Features |
|-------|---------------|----------|
| Phase 1 | Database Design | Messages table, Conversations table |
| Phase 2 | Controllers & Inertia | Load real data, send messages, search |
| Phase 3 | WebSockets & Redis | Real-time messages, online status, typing indicator |
| Phase 4 | Queues | Email notifications, read receipts, file uploads |
| Phase 5 | Auth Depth | Channel authorization, blocking, deleting |
| Phase 6 | Testing Discipline | Unit tests, feature tests, event tests, E2E tests |

---

> **Tip:** Work through the phases in order. Each phase builds on top of the previous one. Don't skip ahead — the skills you learn in Phase 1 are needed for Phase 3!
