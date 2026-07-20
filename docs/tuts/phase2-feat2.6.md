# Phase 2 — Feature 2.6: Chat Request & Accept Notifications

In Feature 2.5, when you search for a user and click on them, a conversation is created **immediately**. But think about it — in real life, would you want a random stranger to just start chatting with you out of nowhere? Probably not!

This feature adds a **chat request system** (like a friend request). Here's the idea:

1. When **User A** wants to chat with **User B**, instead of creating a conversation right away, a **chat request** is sent to User B.
2. **User B** sees a notification bell icon (🔔) in the header with a red badge showing how many people want to chat with them.
3. When User B clicks the bell, they see a dropdown with the names of people who want to chat, along with **Accept** and **Reject** buttons.
4. If they click **Accept**, a conversation is created and both users can start chatting.
5. If they click **Reject**, the request is thrown away and no conversation is created.

---

## Step 1: Create the `chat_requests` Database Table

**Why do we need this?**
Right now, we have no place to store "Hey, User A wants to talk to User B." We need a new table in our database to keep track of who sent a request to who, and whether that request is still waiting (pending), accepted, or rejected.

Think of it like a notebook where we write down:
| sender_id | receiver_id | status   |
|-----------|-------------|----------|
| 5         | 8           | pending  |
| 3         | 5           | accepted |

1. Run this command in your terminal to create the migration file (the blueprint for our new table):
   ```bash
   php artisan make:migration create_chat_requests_table
   ```

2. Open the new file that was just created inside `database/migrations/`. It will be named something like `2026_07_20_XXXXXX_create_chat_requests_table.php`. Replace the content with:
   ```php
   <?php

   use Illuminate\Database\Migrations\Migration;
   use Illuminate\Database\Schema\Blueprint;
   use Illuminate\Support\Facades\Schema;

   return new class extends Migration
   {
       /**
        * Run the migrations.
        */
       public function up(): void
       {
           Schema::create('chat_requests', function (Blueprint $table) {
               $table->id(); // unique ID for each chat request

               // who sent the request (points to the users table)
               $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();

               // who receives the request (also points to the users table)
               $table->foreignId('receiver_id')->constrained('users')->cascadeOnDelete();

               // the current status: starts as "pending", can become "accepted" or "rejected"
               $table->string('status')->default('pending');

               $table->timestamps(); // created_at and updated_at

               // prevent duplicate requests: same sender can't send to same receiver twice
               $table->unique(['sender_id', 'receiver_id']);
           });
       }

       /**
        * Reverse the migrations.
        */
       public function down(): void
       {
           Schema::dropIfExists('chat_requests');
       }
   };
   ```

   **What each column does:**
   - `id` — Every row in the database needs a unique number to identify it, like a ticket number.
   - `sender_id` — This stores the ID of the user who is *sending* the chat request. `constrained('users')` tells the database "this ID must exist in the `users` table." `cascadeOnDelete()` means if the sender's account is deleted, all their chat requests are automatically deleted too.
   - `receiver_id` — Same idea, but for the person *receiving* the request.
   - `status` — A text field that holds one of three values: `pending`, `accepted`, or `rejected`. It starts as `pending` by default.
   - `unique(['sender_id', 'receiver_id'])` — This is a safety rule that prevents the same person from sending multiple requests to the same person. Without this, a user could spam someone with 100 requests!

3. Run the migration to actually create the table in your database:
   ```bash
   php artisan migrate
   ```

---

## Step 2: Create the `ChatRequest` Model

**Why do we need this?**
A model in Laravel is like a "translator" between your PHP code and the database table. Instead of writing raw SQL queries, you use the model to talk to the `chat_requests` table in a clean, readable way. For example, `ChatRequest::create(...)` instead of `INSERT INTO chat_requests ...`.

1. Run this command to generate the model:
   ```bash
   php artisan make:model ChatRequest
   ```

2. Open `app/Models/ChatRequest.php` and replace the content with:
   ```php
   <?php

   namespace App\Models;

   use Illuminate\Database\Eloquent\Model;
   use Illuminate\Database\Eloquent\Relations\BelongsTo;

   class ChatRequest extends Model
   {
       protected $fillable = ['sender_id', 'receiver_id', 'status'];

       // ========== sender ===========
       /**
        * Get the user who sent this chat request
        *
        * @return \Illuminate\Database\Eloquent\Relations\BelongsTo<User, $this>
        */
       public function sender(): BelongsTo
       {
           return $this->belongsTo(User::class, 'sender_id');
       }

       // ========== receiver ===========
       /**
        * Get the user who received this chat request
        *
        * @return \Illuminate\Database\Eloquent\Relations\BelongsTo<User, $this>
        */
       public function receiver(): BelongsTo
       {
           return $this->belongsTo(User::class, 'receiver_id');
       }
   }
   ```

   **What is going on here:**
   - `$fillable` — This is a security feature in Laravel. It tells the model: "Only these columns are allowed to be filled in when creating or updating a record." Without this, a hacker could try to sneak in extra data.
   - `sender()` — This is a **relationship**. It says: "The `sender_id` column in this table points to a user in the `users` table." So when you call `$chatRequest->sender`, Laravel will automatically go to the `users` table, find the user with that ID, and give you their full information (name, email, etc.).
   - `receiver()` — Same thing, but for the person receiving the request.
   - `BelongsTo` — This is the type of relationship. It means "this chat request *belongs to* a user." Think of it like: "This letter (chat request) *belongs to* a sender and *belongs to* a receiver."

3. Now let's add a relationship on the `User` model too. Open `app/Models/User.php` and add this method at the bottom (before the closing `}`):
   ```php
   use Illuminate\Database\Eloquent\Relations\HasMany;

   // ========== receivedChatRequests ===========
   /**
    * Get all chat requests that were sent TO this user
    *
    * @return \Illuminate\Database\Eloquent\Relations\HasMany<ChatRequest, $this>
    */
   public function receivedChatRequests(): HasMany
   {
       return $this->hasMany(ChatRequest::class, 'receiver_id');
   }

   // ========== sentChatRequests ===========
   /**
    * Get all chat requests that were sent BY this user
    *
    * @return \Illuminate\Database\Eloquent\Relations\HasMany<ChatRequest, $this>
    */
   public function sentChatRequests(): HasMany
   {
       return $this->hasMany(ChatRequest::class, 'sender_id');
   }
   ```

   **Why add this to User?**
   - `receivedChatRequests()` — When we want to show the bell notification, we need to ask: "How many pending requests does this user have?" This relationship lets us easily do `$user->receivedChatRequests` to get all of them.
   - `sentChatRequests()` — We need this to check: "Did User A already send a request to User B?" to prevent duplicates.

---

## Step 3: Create the `ChatRequestController` (Backend)

**Why do we need this?**
A controller is where all the "business logic" lives. When the frontend says "send a chat request" or "accept this request", the controller is the one that actually does the work — talking to the database, checking rules, and sending back a response.

1. Run this command to create the controller:
   ```bash
   php artisan make:controller ChatRequestController
   ```

2. Open `app/Http/Controllers/ChatRequestController.php` and replace the content with:
   ```php
   <?php

   namespace App\Http\Controllers;

   use App\Models\ChatRequest;
   use App\Models\Conversation;
   use Illuminate\Http\JsonResponse;
   use Illuminate\Http\Request;

   class ChatRequestController extends Controller
   {
       // ========== pending ===========
       // Get all pending chat requests for the currently logged in user
       // This is used by the notification bell to show who wants to chat with you
       public function pending(Request $request): JsonResponse
       {
           /** @var \App\Models\User $user */
           $user = $request->user();

           // find all chat requests where I am the receiver and the status is still "pending"
           // with('sender') tells Laravel: "Also grab the sender's info (name, email) so we can show it"
           $pendingRequests = $user->receivedChatRequests()
               ->where('status', 'pending')
               ->with('sender')
               ->get();

           return response()->json($pendingRequests);
       }

       // ========== store ===========
       // Send a new chat request to another user
       public function store(Request $request): JsonResponse
       {
           // make sure the frontend sent a valid user_id
           $request->validate([
               'receiver_id' => ['required', 'exists:users,id'],
           ]);

           /** @var \App\Models\User $user */
           $user = $request->user();
           $receiverId = $request->input('receiver_id');

           // RULE 1: You can't send a chat request to yourself!
           if ($user->id == $receiverId) {
               return response()->json(
                   ['message' => 'You cannot send a chat request to yourself.'],
                   422 // 422 means "I understand your request, but it doesn't make sense"
               );
           }

           // RULE 2: Check if a conversation already exists between these two users
           // If they already have a chat, there's no need for a request!
           $existingConversation = $user->conversations()
               ->whereHas('users', function ($q) use ($receiverId) {
                   $q->where('users.id', $receiverId);
               })
               ->first();

           if ($existingConversation) {
               return response()->json(
                   ['message' => 'You already have a conversation with this user.'],
                   422
               );
           }

           // RULE 3: Check if there's already a pending request between these two users
           // (in either direction — maybe THEY already sent YOU a request!)
           $existingRequest = ChatRequest::where(function ($q) use ($user, $receiverId) {
               $q->where('sender_id', $user->id)
                 ->where('receiver_id', $receiverId);
           })
           ->orWhere(function ($q) use ($user, $receiverId) {
               $q->where('sender_id', $receiverId)
                 ->where('receiver_id', $user->id);
           })
           ->where('status', 'pending')
           ->first();

           if ($existingRequest) {
               return response()->json(
                   ['message' => 'A chat request already exists between you and this user.'],
                   422
               );
           }

           // All rules passed! Create the chat request
           $chatRequest = ChatRequest::create([
               'sender_id' => $user->id,
               'receiver_id' => $receiverId,
               'status' => 'pending',
           ]);

           return response()->json($chatRequest, 201); // 201 means "successfully created"
       }

       // ========== accept ===========
       // Accept a chat request and create a conversation between the two users
       public function accept(ChatRequest $chatRequest): JsonResponse
       {
           // only the person who RECEIVED the request should be able to accept it
           // (we'll check this with a policy or middleware later, for now we trust the route)

           // change the status from "pending" to "accepted"
           $chatRequest->update(['status' => 'accepted']);

           // now create a real conversation between the sender and receiver
           $conversation = Conversation::create();
           $conversation->users()->attach([
               $chatRequest->sender_id,
               $chatRequest->receiver_id,
           ]);

           return response()->json($conversation);
       }

       // ========== reject ===========
       // Reject a chat request (no conversation is created)
       public function reject(ChatRequest $chatRequest): JsonResponse
       {
           // change the status from "pending" to "rejected"
           $chatRequest->update(['status' => 'rejected']);

           return response()->json(['message' => 'Chat request rejected.']);
       }
   }
   ```

   **Breaking down each method:**

   - **`pending()`** — The frontend calls this when it loads the page (or when the user clicks the bell). It asks: "Give me all the chat requests that are waiting for me to accept or reject." The `with('sender')` part is important — it tells Laravel to also load the sender's name and email so we can display them in the dropdown.

   - **`store()`** — This runs when User A clicks on User B in the search results. Before creating the request, it checks 3 rules:
     1. You can't send a request to yourself (that would be weird).
     2. You can't send a request if you already have a conversation with that person (just open the existing chat!).
     3. You can't send a request if there's already a pending request between you two (no spamming!).
   
   - **`accept()`** — This runs when User B clicks the "Accept" button. It does two things: (1) changes the request status to "accepted" and (2) creates a brand new conversation and attaches both users to it — just like `ConversationController@store` used to do!

   - **`reject()`** — This simply changes the request status to "rejected." No conversation is created.

   - **`ChatRequest $chatRequest` in accept/reject** — This is called **route model binding**. Laravel automatically looks at the URL (like `/chat-requests/5/accept`), takes the `5`, and goes to the database to find the ChatRequest with ID 5. If it doesn't exist, Laravel returns a 404 error automatically. So you don't need to manually do `ChatRequest::find($id)`!

---

## Step 4: Add the Routes

**Why do we need routes?**
Routes are like the "address book" of your app. They tell Laravel: "When someone visits this URL, run this controller method." Without routes, your frontend has no way to talk to your backend.

1. Open `routes/web.php` and add these new routes inside the `auth` middleware group:
   ```php
   use App\Http\Controllers\ChatRequestController;

   // inside the auth middleware group, add:

   // get all pending chat requests (for the bell icon)
   Route::get('chat-requests/pending', [ChatRequestController::class, 'pending'])
       ->name('chat-requests.pending');

   // send a new chat request
   Route::post('chat-requests', [ChatRequestController::class, 'store'])
       ->name('chat-requests.store');

   // accept a chat request (PATCH because we're updating the status, not creating something new)
   Route::patch('chat-requests/{chatRequest}/accept', [ChatRequestController::class, 'accept'])
       ->name('chat-requests.accept');

   // reject a chat request
   Route::patch('chat-requests/{chatRequest}/reject', [ChatRequestController::class, 'reject'])
       ->name('chat-requests.reject');
   ```

   **Why `PATCH` instead of `POST` for accept/reject?**
   Remember the HTTP verbs we learned:
   - `GET` = read/retrieve data
   - `POST` = create new data
   - `PATCH` = update existing data
   - `DELETE` = delete data

   When we accept or reject a request, we're not creating anything new — we're *updating* the status of an existing chat request from "pending" to "accepted" or "rejected." That's why we use `PATCH`!

   **What is `{chatRequest}` in the URL?**
   This is a **route parameter**. When the frontend sends a request to `/chat-requests/7/accept`, Laravel takes that `7` and automatically finds the ChatRequest with ID 7 in the database (this is the route model binding we mentioned earlier).

---

## Step 5: Update the "New Chat" Feature (Frontend — Change Feature 2.5)

**Why do we need to change this?**
In Feature 2.5, when you clicked on a user in the search results, it immediately created a conversation. Now we want to change that behavior — instead of creating a conversation, it should **send a chat request** to that user. The conversation will only be created when the other person accepts.

1. Open `resources/js/pages/Home.tsx`.

2. Find the `startNewChat` function (the one that sends a POST to `/conversations`). We need to **replace** it with a new function that sends a chat request instead:
   ```tsx
   // send a chat request to the selected user (instead of creating a conversation immediately)
   const startNewChat = async (userId: number) => {
       try {
           const response = await fetch('/chat-requests', {
               method: 'POST',
               headers: {
                   'Content-Type': 'application/json',
                   'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
               },
               body: JSON.stringify({ receiver_id: userId }),
           });

           if (response.ok) {
               // close the modal and show success
               setIsNewChatModalOpen(false);
               setUserSearchQuery('');
               alert('Chat request sent!');
           } else {
               // if the backend returned an error (like duplicate request), show it
               const errorData = await response.json();
               alert(errorData.message || 'Failed to send chat request.');
           }
       } catch (error) {
           console.error("Failed to send chat request", error);
       }
   };
   ```

   **What changed?**
   - The URL changed from `/conversations` to `/chat-requests` — we're now hitting the new `ChatRequestController@store` instead of `ConversationController@store`.
   - The body data changed from `{ user_id: userId }` to `{ receiver_id: userId }` — because our new controller expects `receiver_id`.
   - Instead of `window.location.reload()`, we now close the modal and show a success message. No conversation is created yet — it's just a request waiting for the other person to accept!
   - We also handle the error case now (like if they already sent a request to that person).

---

## Step 6: Add Chat Request State & Functions (Frontend)

**Why do we need this?**
The notification bell needs to know: "How many pending requests are there?" and "What are the names of the people who sent them?" We need state variables to store this data and functions to fetch/accept/reject requests.

1. First, add a new TypeScript interface for the chat request data. Put this near the top of `Home.tsx`, next to the existing `UserSearchResult` interface:
   ```tsx
   interface ChatRequestData {
       id: number;
       sender_id: number;
       receiver_id: number;
       status: string;
       sender: {
           id: number;
           name: string;
           email: string;
       };
   }
   ```
   This tells React: "A chat request object looks like this — it has an ID, sender/receiver IDs, a status, and the sender's info (name, email)."

2. Inside the `Home` component, add these new state variables (below your existing new chat modal state):
   ```tsx
   // ======== CHAT REQUEST NOTIFICATION STATE ==========
   const [chatRequests, setChatRequests] = useState<ChatRequestData[]>([]);
   const [isNotifOpen, setIsNotifOpen] = useState(false);
   ```
   - `chatRequests` — stores the list of pending chat requests from the backend.
   - `isNotifOpen` — controls whether the notification dropdown is open or closed (like a light switch: true = open, false = closed).

3. Add a `useEffect` to automatically load pending chat requests when the page loads:
   ```tsx
   // load pending chat requests when the page first loads
   useEffect(() => {
       const fetchPendingRequests = async () => {
           try {
               const response = await fetch('/chat-requests/pending');
               if (response.ok) {
                   const data = await response.json();
                   setChatRequests(data);
               }
           } catch (error) {
               console.error("Failed to fetch chat requests", error);
           }
       };

       fetchPendingRequests();
   }, []); // empty array [] means: run this only ONCE when the page loads
   ```

   **Why `[]` (empty array)?**
   Remember how `[userSearchQuery]` in the search `useEffect` means "run every time `userSearchQuery` changes"? An empty `[]` means "run this only once when the component first appears on screen." We only need to check for pending requests when the page loads.

4. Add functions to handle accepting and rejecting requests:
   ```tsx
   // accept a chat request
   const acceptRequest = async (requestId: number) => {
       try {
           const response = await fetch(`/chat-requests/${requestId}/accept`, {
               method: 'PATCH',
               headers: {
                   'Content-Type': 'application/json',
                   'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
               },
           });

           if (response.ok) {
               // reload the page so the new conversation shows up in the sidebar
               window.location.reload();
           }
       } catch (error) {
           console.error("Failed to accept request", error);
       }
   };

   // reject a chat request
   const rejectRequest = async (requestId: number) => {
       try {
           const response = await fetch(`/chat-requests/${requestId}/reject`, {
               method: 'PATCH',
               headers: {
                   'Content-Type': 'application/json',
                   'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
               },
           });

           if (response.ok) {
               // remove the rejected request from our local state (so it disappears from the dropdown)
               setChatRequests(prev => prev.filter(r => r.id !== requestId));
           }
       } catch (error) {
           console.error("Failed to reject request", error);
       }
   };
   ```

   **What's the difference between accept and reject?**
   - **Accept**: We reload the whole page because a new conversation was just created on the backend. The `ConversationController@index` needs to run again to format it and add it to the sidebar.
   - **Reject**: We don't need to reload. Instead, we use `setChatRequests(prev => prev.filter(r => r.id !== requestId))` which says: "Take the current list of requests, and keep only the ones whose ID is NOT the one we just rejected." This makes the rejected request disappear from the dropdown instantly without a page reload!

---

## Step 7: Update the Notification Bell UI (Frontend)

**Why do we need this?**
Right now the bell icon in the header is just a decoration — it doesn't do anything when you click it. We need to make it actually show the pending chat requests in a dropdown.

1. Find the existing notification bell button in `Home.tsx` (in the header area). It currently looks like this:
   ```tsx
   {/* Notification Bell */}
   <button
       aria-label="Notifications"
       className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/40 transition-all duration-150"
   >
       <Bell className="w-5 h-5" />
       {/* Badge — shows count of pending chat requests (placeholder for now) */}
       {/*<span className="absolute ...">2</span>*/}
   </button>
   ```

2. Replace the entire notification bell section with this:
   ```tsx
   {/* Notification Bell */}
   <div className="relative">
       <button
           onClick={() => setIsNotifOpen(!isNotifOpen)}
           aria-label="Notifications"
           className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/40 transition-all duration-150"
       >
           <Bell className="w-5 h-5" />
           {/* Badge — shows the count of pending requests (only if there are any) */}
           {chatRequests.length > 0 && (
               <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold font-sans leading-none">
                   {chatRequests.length}
               </span>
           )}
       </button>

       {/* Notification Dropdown — shows when you click the bell */}
       {isNotifOpen && (
           <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-2xl shadow-xl overflow-hidden z-50">
               <div className="px-4 py-3 border-b border-border">
                   <h4 className="font-bold font-sans text-sm text-foreground">Chat Requests</h4>
               </div>
               <div className="max-h-64 overflow-y-auto">
                   {chatRequests.length === 0 ? (
                       <p className="text-center text-sm text-muted-foreground py-6 font-sans">
                           No pending requests.
                       </p>
                   ) : (
                       chatRequests.map(req => (
                           <div
                               key={req.id}
                               className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0"
                           >
                               {/* Sender avatar (first 2 letters of their name) */}
                               <div className="w-10 h-10 rounded-full bg-accent/20 text-accent dark:text-accent-alt flex items-center justify-center font-bold font-sans flex-shrink-0">
                                   {req.sender.name.substring(0, 2).toUpperCase()}
                               </div>

                               {/* Sender info */}
                               <div className="flex-1 min-w-0">
                                   <p className="text-sm font-bold font-sans text-foreground truncate">
                                       {req.sender.name}
                                   </p>
                                   <p className="text-xs font-sans text-muted-foreground truncate">
                                       wants to chat with you
                                   </p>
                               </div>

                               {/* Accept & Reject buttons */}
                               <div className="flex gap-1.5 flex-shrink-0">
                                   <button
                                       onClick={() => acceptRequest(req.id)}
                                       className="px-3 py-1.5 text-xs font-bold font-sans rounded-lg bg-accent dark:bg-accent-alt text-white hover:opacity-90 transition-opacity"
                                   >
                                       Accept
                                   </button>
                                   <button
                                       onClick={() => rejectRequest(req.id)}
                                       className="px-3 py-1.5 text-xs font-bold font-sans rounded-lg bg-muted text-muted-foreground hover:bg-red-500/20 hover:text-red-500 transition-colors"
                                   >
                                       Reject
                                   </button>
                               </div>
                           </div>
                       ))
                   )}
               </div>
           </div>
       )}
   </div>
   ```

   **What does this UI do?**
   - The bell icon now has an `onClick` that toggles the dropdown open and closed.
   - The red badge (`chatRequests.length > 0 &&`) only appears when there are pending requests. If there are 3 pending requests, it shows "3".
   - When you click the bell, a dropdown appears showing each pending request with the sender's avatar, name, and two buttons.
   - Clicking "Accept" calls `acceptRequest(req.id)` which hits the backend, creates the conversation, and reloads the page.
   - Clicking "Reject" calls `rejectRequest(req.id)` which hits the backend and removes the request from the list.

---

## Step 8: Write the Pest Tests

**Why do we need tests?**
Tests are like a safety net. They automatically check that your code works correctly. If you change something in the future and accidentally break the chat request feature, the tests will catch it and tell you exactly what went wrong. Think of tests as a robot that clicks all the buttons in your app for you and says "everything works!" or "this broke!"

1. Create a new test file:
   ```bash
   php artisan make:test ChatRequestControllerTest --pest
   ```

2. Open `tests/Feature/ChatRequestControllerTest.php` and replace the content with:
   ```php
   <?php

   use App\Models\User;
   use App\Models\ChatRequest;
   use App\Models\Conversation;
   use Illuminate\Foundation\Testing\RefreshDatabase;

   uses(RefreshDatabase::class);

   test('user can send a chat request to another user', function () {
       /** @var \App\Models\User $sender */
       $sender = User::factory()->create();

       /** @var \App\Models\User $receiver */
       $receiver = User::factory()->create();

       /** @var \Tests\TestCase $this */
       $response = $this->actingAs($sender)->postJson(route('chat-requests.store'), [
           'receiver_id' => $receiver->id,
       ]);

       $response->assertStatus(201); // 201 means "created"

       // check if the chat request was saved in the database
       $this->assertDatabaseHas('chat_requests', [
           'sender_id' => $sender->id,
           'receiver_id' => $receiver->id,
           'status' => 'pending',
       ]);
   });

   test('accepting a chat request creates a conversation with both users', function () {
       /** @var \App\Models\User $sender */
       $sender = User::factory()->create();

       /** @var \App\Models\User $receiver */
       $receiver = User::factory()->create();

       // create a pending chat request in the database
       $chatRequest = ChatRequest::create([
           'sender_id' => $sender->id,
           'receiver_id' => $receiver->id,
           'status' => 'pending',
       ]);

       // the RECEIVER accepts the request
       /** @var \Tests\TestCase $this */
       $response = $this->actingAs($receiver)->patchJson(
           route('chat-requests.accept', $chatRequest)
       );

       $response->assertOk();

       // check that the request status changed to "accepted"
       $this->assertDatabaseHas('chat_requests', [
           'id' => $chatRequest->id,
           'status' => 'accepted',
       ]);

       // check that a conversation was created
       $this->assertDatabaseCount('conversations', 1);

       // check that both users are attached to the conversation
       $this->assertDatabaseCount('conversation_user', 2);
   });

   test('rejecting a chat request does not create a conversation', function () {
       /** @var \App\Models\User $sender */
       $sender = User::factory()->create();

       /** @var \App\Models\User $receiver */
       $receiver = User::factory()->create();

       // create a pending chat request
       $chatRequest = ChatRequest::create([
           'sender_id' => $sender->id,
           'receiver_id' => $receiver->id,
           'status' => 'pending',
       ]);

       // the RECEIVER rejects the request
       /** @var \Tests\TestCase $this */
       $response = $this->actingAs($receiver)->patchJson(
           route('chat-requests.reject', $chatRequest)
       );

       $response->assertOk();

       // check that the request status changed to "rejected"
       $this->assertDatabaseHas('chat_requests', [
           'id' => $chatRequest->id,
           'status' => 'rejected',
       ]);

       // check that NO conversation was created
       $this->assertDatabaseCount('conversations', 0);
   });

   test('user cannot send a duplicate chat request', function () {
       /** @var \App\Models\User $sender */
       $sender = User::factory()->create();

       /** @var \App\Models\User $receiver */
       $receiver = User::factory()->create();

       // create the first request (this should work)
       ChatRequest::create([
           'sender_id' => $sender->id,
           'receiver_id' => $receiver->id,
           'status' => 'pending',
       ]);

       // try to send a SECOND request to the same person (this should fail)
       /** @var \Tests\TestCase $this */
       $response = $this->actingAs($sender)->postJson(route('chat-requests.store'), [
           'receiver_id' => $receiver->id,
       ]);

       $response->assertStatus(422); // 422 means "invalid request"

       // there should still be only 1 chat request in the database
       $this->assertDatabaseCount('chat_requests', 1);
   });

   test('user cannot send a chat request to themselves', function () {
       /** @var \App\Models\User $user */
       $user = User::factory()->create();

       // try to send a request to yourself
       /** @var \Tests\TestCase $this */
       $response = $this->actingAs($user)->postJson(route('chat-requests.store'), [
           'receiver_id' => $user->id,
       ]);

       $response->assertStatus(422); // should be rejected

       // no chat request should be in the database
       $this->assertDatabaseCount('chat_requests', 0);
   });
   ```

   **What each test checks:**
   - **Test 1**: Can a user send a chat request? After sending, we check the database to make sure a row was created with `status: pending`.
   - **Test 2**: When we accept a request, does it create a conversation? We check 3 things: the status changed to "accepted", a conversation was created, and both users are attached to it.
   - **Test 3**: When we reject a request, does it NOT create a conversation? The status should be "rejected" and the conversations table should be empty.
   - **Test 4**: Can someone spam the same request twice? We create one request first, then try to create another. The second one should be rejected with a 422 error.
   - **Test 5**: Can someone send a request to themselves? That would be weird, so we make sure it's rejected.

3. Run the tests:
   ```bash
   php artisan test
   ```

---

## Explanation Summary

* **`chat_requests` table**: A new database table that stores who wants to chat with who and whether they've accepted or rejected. Think of it as a "waiting room" before a conversation starts.
* **`ChatRequest` model**: The PHP class that lets you easily interact with the `chat_requests` table using clean code like `ChatRequest::create(...)` instead of raw SQL.
* **`ChatRequestController`**: Has 4 methods:
  - `pending()` — Shows all requests waiting for you
  - `store()` — Sends a new request (with 3 safety checks: no self-requests, no duplicates, no existing conversations)
  - `accept()` — Changes status to "accepted" and creates a conversation
  - `reject()` — Changes status to "rejected" (no conversation created)
* **Routes**: `GET` to fetch pending requests, `POST` to create a new request, `PATCH` to update (accept/reject) an existing request.
* **Frontend changes**: The `startNewChat` function now sends a chat request instead of creating a conversation. The bell icon shows a badge with the count of pending requests and a dropdown to accept or reject them.
* **Tests**: 5 automated tests that verify everything works: sending requests, accepting, rejecting, preventing duplicates, and preventing self-requests.
