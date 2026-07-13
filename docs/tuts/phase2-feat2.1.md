# Phase 2 — Feature 2.1: Load Real Conversations in the Sidebar

In this tutorial, we will replace the hardcoded chat list in `Home.tsx` with real conversations fetched from the database for the currently logged-in user.

---

## Step-by-Step Implementation

### Step 1: Create the `ConversationController`
We need a controller to handle the database query and pass the data to our Inertia React frontend.

1. In your terminal, run the command:
   ```bash
   php artisan make:controller ConversationController
   ```

2. Open the newly created `app/Http/Controllers/ConversationController.php` file.

3. Replace its contents with the code below. We are fetching the authenticated user's conversations, eager-loading the `users` and `messages`, formatting them to match the React component's structure, and returning an Inertia response:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ConversationController extends Controller
{
    // ========== index ===========
    // Fetch and return the authenticated user's conversations
    public function index(Request $request): Response
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        // Get conversations the user is participating in
        $conversations = $user->conversations()
            ->with(['users', 'messages' => function ($query) {
                $query->latest()->limit(1);
            }])
            ->get()
            ->map(function (Conversation $conversation) use ($user) {
                // Find the other user in the 1-on-1 chat
                $otherUser = $conversation->users->firstWhere('id', '!=', $user->id);

                // Get the latest message
                $lastMessage = $conversation->messages->first();

                return [
                    'id' => $conversation->id,
                    'name' => $otherUser ? $otherUser->name : 'Saved Messages',
                    'lastMessage' => $lastMessage ? $lastMessage->body : '',
                    'time' => $lastMessage ? $lastMessage->created_at->diffForHumans(short: true) : '',
                    'avatar' => $otherUser ? strtoupper(substr($otherUser->name, 0, 2)) : 'SM',
                    'unread' => 0, // Placeholder for now
                    'online' => false, // Placeholder for now
                ];
            });

        return Inertia::render('Home', [
            'conversations' => $conversations,
        ]);
    }
}
```

> [!NOTE]
> We used `/** @var \App\Models\User $user */` to tell PHPStan that `$request->user()` returns our custom `User` model, which prevents type-checking errors about the `conversations()` method.

---

### Step 2: Update the Web Routes
Instead of directly loading the page using `Route::inertia()`, we now want to route through our new controller.

1. Open `routes/web.php`.
2. Import the controller at the top:
   ```php
   use App\Http\Controllers\ConversationController;
   ```
3. Update the `dashboard` route to use our new controller:
   ```php
   Route::middleware(['auth', 'verified'])->group(function () {
       Route::get('dashboard', [ConversationController::class, 'index'])->name('dashboard');
   });
   ```

---

### Step 3: Receive and render real props in `Home.tsx`
Now we need to update our React frontend to receive the conversations data and display it in the sidebar.

1. Open `resources/js/pages/Home.tsx`.
2. Define the TypeScript type for `Conversation` at the top of the file, below the imports:
   ```typescript
   interface Conversation {
       id: number;
       name: string;
       lastMessage: string;
       time: string;
       avatar: string;
       unread: number;
       online: boolean;
   }
   ```
3. Locate the hardcoded `const conversations = [...]` array (lines 6-13) and **delete** it.
4. Update the `Home` component signature to accept the `conversations` prop:
   ```typescript
   export default function Home({ conversations = [] }: { conversations?: Conversation[] }) {
   ```
5. Find the line:
   ```typescript
   const activeConvo = conversations[0];
   ```
   Since the user might not have any conversations yet when they log in, we should add a fallback so the app doesn't crash:
   ```typescript
   const activeConvo = conversations[0] || null;
   ```
6. Update where `activeConvo` is used in the layout to handle when it is `null`. For example, around line 204:
   ```typescript
   {activeConvo ? (
       <div className="flex items-center gap-3">
           <Avatar initials={activeConvo.avatar} online={activeConvo.online} size="lg" />
           <div>
               <p className="text-sm font-bold font-sans text-foreground">{activeConvo.name}</p>
               <p className="text-xs font-sans text-green-500">
                   {activeConvo.online ? 'Active now' : 'Offline'}
               </p>
           </div>
       </div>
   ) : (
       <p className="text-sm text-muted-foreground font-sans">Select a conversation to start chatting</p>
   )}
   ```
7. Similarly, wrap the messages list and the message input in a condition so they only render when an `activeConvo` exists.

---

### Step 4: Write the Controller Test
1. In your terminal, run the command to create the test file:
   ```bash
   php artisan pest:test ConversationControllerTest
   ```
2. Open `tests/Feature/ConversationControllerTest.php` and replace its contents with the test below:

```php
<?php

use App\Models\User;
use App\Models\Conversation;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('logged in user can view their conversations in the sidebar', function () {
    // 1. ARRANGE: Create 2 users and link them in a conversation
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $conversation = Conversation::create();
    $conversation->users()->attach([$user->id, $otherUser->id]);

    // 2. ACT: Request the dashboard route
    $response = $this->actingAs($user)->get(route('dashboard'));

    // 3. ASSERT: Assert page loads and contains the conversation data in the props
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('Home')
        ->has('conversations', 1)
        ->where('conversations.0.name', $otherUser->name)
    );
});
```

---

## Verification

To verify that your code works and passes all static analysis:

1. Run the test suite:
   ```bash
   php artisan test
   ```
2. Run the type checker:
   ```bash
   composer types:check
   ```
