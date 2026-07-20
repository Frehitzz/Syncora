# Phase 2 — Feature 2.5: Start a New Conversation

Right now, you can only see conversations that were already created in the database (like when we used seeders). There is no way for a user to start a new chat with someone! 

In this feature, we will build a "New Chat" button that opens a popup (modal). Inside that popup, you can search for other registered users by their name or email. When you click on a user, it will either create a brand new conversation with them, or if you already have a history with them, it will just open your existing chat.

---

## Step 1: Create the User Search Endpoint (Backend)

First, we need a way for the frontend to ask the database: "Are there any users whose name or email matches what I just typed?"

1. Let's create a new controller specifically for searching users. In your terminal, run:
   ```bash
   php artisan make:controller UserController
   ```

2. Open `app/Http/Controllers/UserController.php` and add a `search` method:
   ```php
   <?php

   namespace App\Http\Controllers;

   use App\Models\User;
   use Illuminate\Http\Request;
   use Illuminate\Http\JsonResponse;

   class UserController extends Controller
   {
       // =========== search =========
       // finds users matching the search query, excluding the currently logged-in user
       public function search(Request $request): JsonResponse
       {
           $query = $request->input('query');

           // if the search box is empty, return an empty array
           if (!$query) {
               return response()->json([]);
           }

           /** @var \App\Models\User $user */
           $user = $request->user();

           // search the database for names or emails that match, but don't include ourselves!
           $users = User::where('id', '!=', $user->id)
               ->where(function ($q) use ($query) {
                   $q->where('name', 'like', '%' . $query . '%')
                     ->orWhere('email', 'like', '%' . $query . '%');
               })
               ->limit(10) // only return up to 10 people so we don't overload the frontend
               ->get(['id', 'name', 'email']);

           return response()->json($users);
       }
   }
   ```

3. Open `routes/web.php` and add the new route (inside the `auth` middleware group):
   ```php
   use App\Http\Controllers\UserController;
   
   // ... inside the auth middleware group:
   Route::get('users/search', [UserController::class, 'search'])->name('users.search');
   ```

---

## Step 2: Create the Conversation Endpoint (Backend)

When the user clicks on someone from the search results, we need to create a conversation. 

4. Open `app/Http/Controllers/ConversationController.php` and add the `store` method:
   ```php
   use Illuminate\Http\JsonResponse;

   // =========== store =========
   // creates a new conversation between the logged-in user and another user
   public function store(Request $request): JsonResponse
   {
       // validate that they sent a valid user_id
       $request->validate([
           'user_id' => ['required', 'exists:users,id']
       ]);

       /** @var \App\Models\User $user */
       $user = $request->user();
       $otherUserId = $request->input('user_id');

       // Check if a conversation between these two users ALREADY exists.
       // We don't want to create duplicates!
       $existingConversation = $user->conversations()
           ->whereHas('users', function ($q) use ($otherUserId) {
               $q->where('users.id', $otherUserId);
           })
           ->first();

       if ($existingConversation) {
           // If they already have a chat, just return it
           return response()->json($existingConversation);
       }

       // Otherwise, create a brand new conversation
       $conversation = Conversation::create();
       
       // Attach BOTH users to this new conversation
       $conversation->users()->attach([$user->id, $otherUserId]);

       return response()->json($conversation);
   }
   ```

5. Open `routes/web.php` and add the POST route for conversations:
   ```php
   Route::post('conversations', [ConversationController::class, 'store'])->name('conversations.store');
   ```

---

## Step 3: Add State Variables for the Modal (Frontend)

Now let's move to React. We need state to control our "New Chat" popup.

6. Open `resources/js/pages/Home.tsx`.

7. At the top of the file, we need to import a new icon. Add `Edit` to the Lucide React imports:
   ```tsx
   import { Moon, Sun, Search, MoreHorizontal, Info, Phone, Video, Bell, Edit } from 'lucide-react';
   ```

8. Also, let's define a TypeScript type for our User search results. Add this right above the `Home` component (around line 105):
   ```tsx
   interface UserSearchResult {
       id: number;
       name: string;
       email: string;
   }
   ```

9. Inside the `Home` component (below your `searchQuery` state), add these new state variables:
   ```tsx
    // ======== NEW CHAT MODAL STATE ==========
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
   ```

---

## Step 4: Create Frontend Functions for Searching and Creating

10. Below your state variables, add a `useEffect` that automatically searches the backend whenever the `userSearchQuery` changes:
    ```tsx
    // search the database for users when the query changes
    useEffect(() => {
        // if they cleared the box, clear the results
        if (userSearchQuery.trim() === '') {
            setUserSearchResults([]);
            return;
        }

        const searchUsers = async () => {
            setIsSearchingUsers(true);
            try {
                const response = await fetch(`/users/search?query=${encodeURIComponent(userSearchQuery)}`);
                if (response.ok) {
                    const data = await response.json();
                    setUserSearchResults(data);
                }
            } catch (error) {
                console.error("Failed to search users", error);
            } finally {
                setIsSearchingUsers(false);
            }
        };

        // debounce: wait 300ms after they stop typing before sending the request
        // this prevents spamming the server on every single keystroke!
        const delayTimer = setTimeout(searchUsers, 300);
        return () => clearTimeout(delayTimer);
    }, [userSearchQuery]);
    ```

11. Add the function that creates the conversation when they click a user:
    ```tsx
    // send request to create a new conversation with the selected user
    const startNewChat = async (userId: number) => {
        try {
            const response = await fetch('/conversations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                },
                body: JSON.stringify({ user_id: userId }),
            });

            if (response.ok) {
                const newConvo = await response.json();
                
                // IMPORTANT: In a real app, the backend should return the fully formatted 
                // conversation object (with name, avatar, time). 
                // Since our backend currently just returns the raw model, we will reload the page 
                // so the ConversationController@index can format everything nicely for us!
                window.location.reload();
            }
        } catch (error) {
            console.error("Failed to start chat", error);
        }
    };
    ```

---

## Step 5: Add the "New Chat" Button

12. Find the "More Options" button in the left sidebar top bar (around line 304 in `Home.tsx`). Right **before** it, add the New Chat button:
    ```tsx
    {/* New Chat Button */}
    <button
        onClick={() => setIsNewChatModalOpen(true)}
        aria-label="New chat"
        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/40 transition-all"
    >
        <Edit className="w-4 h-4" />
    </button>
    ```

---

## Step 6: Add the Modal UI

13. Finally, we need to draw the modal overlay on top of the screen when `isNewChatModalOpen` is true. Go to the very bottom of `Home.tsx`, right before the closing `</>` tag (around line 450), and add:
    ```tsx
    {/* ── New Chat Modal Overlay ── */}
    {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h3 className="font-bold font-sans text-foreground">Start New Chat</h3>
                    <button 
                        onClick={() => {
                            setIsNewChatModalOpen(false);
                            setUserSearchQuery('');
                        }}
                        className="text-muted-foreground hover:text-foreground text-sm font-sans"
                    >
                        Close
                    </button>
                </div>

                {/* Modal Body - Search Input */}
                <div className="p-4 border-b border-border">
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        autoFocus
                        className="w-full px-4 py-2.5 text-sm font-sans rounded-xl bg-muted/50 dark:bg-muted/20 border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-accent dark:focus:border-accent-alt focus:ring-1 focus:ring-accent/20 transition-all"
                    />
                </div>

                {/* Modal Body - Search Results */}
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                    {isSearchingUsers ? (
                        <p className="text-center text-sm text-muted-foreground py-8 font-sans">Searching...</p>
                    ) : userSearchResults.length > 0 ? (
                        userSearchResults.map(user => (
                            <button
                                key={user.id}
                                onClick={() => startNewChat(user.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 dark:hover:bg-muted/20 rounded-xl transition-colors"
                            >
                                <div className="w-10 h-10 rounded-full bg-accent/20 text-accent dark:text-accent-alt flex items-center justify-center font-bold font-sans flex-shrink-0">
                                    {user.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold font-sans text-foreground truncate">{user.name}</p>
                                    <p className="text-xs font-sans text-muted-foreground truncate">{user.email}</p>
                                </div>
                            </button>
                        ))
                    ) : userSearchQuery !== '' ? (
                        <p className="text-center text-sm text-muted-foreground py-8 font-sans">No users found.</p>
                    ) : (
                        <p className="text-center text-sm text-muted-foreground py-8 font-sans">Type a name to search.</p>
                    )}
                </div>

            </div>
        </div>
    )}
    ```

---

## Step 7: Write the Pest Tests

Let's make sure our backend logic is bulletproof.

1. Create a new test file for the user search:
   ```bash
   php artisan make:test UserControllerTest --pest
   ```

2. Open `tests/Feature/UserControllerTest.php` and add:
   ```php
   <?php

   use App\Models\User;
   use Illuminate\Foundation\Testing\RefreshDatabase;

   uses(RefreshDatabase::class);

   test('user can search for other users by name', function () {
       /** @var \App\Models\User $user */
       $user = User::factory()->create();

       User::factory()->create(['name' => 'Alice Smith']);
       User::factory()->create(['name' => 'Bob Jones']);

       /** @var \Tests\TestCase $this */
       $response = $this->actingAs($user)->getJson('/users/search?query=Alice');

       $response->assertOk();
       $response->assertJsonCount(1);
       $response->assertJsonFragment(['name' => 'Alice Smith']);
       $response->assertJsonMissing(['name' => 'Bob Jones']);
   });

   test('search does not return the logged in user', function () {
       /** @var \App\Models\User $user */
       $user = User::factory()->create(['name' => 'Charlie Charlie']);

       /** @var \Tests\TestCase $this */
       $response = $this->actingAs($user)->getJson('/users/search?query=Charlie');

       $response->assertOk();
       $response->assertJsonCount(0); // Should be 0 because we exclude ourselves
   });
   ```

3. Open your existing `tests/Feature/ConversationControllerTest.php` and add these tests at the bottom:
   ```php
   test('user can create a new conversation with another user', function () {
       /** @var \App\Models\User $user */
       $user = User::factory()->create();
       
       /** @var \App\Models\User $otherUser */
       $otherUser = User::factory()->create();

       /** @var \Tests\TestCase $this */
       $response = $this->actingAs($user)->postJson(route('conversations.store'), [
           'user_id' => $otherUser->id
       ]);

       $response->assertOk();
       
       // Verify the conversation was created and both users are attached
       $this->assertDatabaseCount('conversations', 1);
       $this->assertDatabaseCount('conversation_user', 2);
   });

   test('creating a conversation with an existing partner returns the existing conversation', function () {
       /** @var \App\Models\User $user */
       $user = User::factory()->create();
       
       /** @var \App\Models\User $otherUser */
       $otherUser = User::factory()->create();

       // Create an existing conversation
       $conversation = \App\Models\Conversation::create();
       $conversation->users()->attach([$user->id, $otherUser->id]);

       // Try to create another one
       /** @var \Tests\TestCase $this */
       $response = $this->actingAs($user)->postJson(route('conversations.store'), [
           'user_id' => $otherUser->id
       ]);

       $response->assertOk();
       
       // Verify NO new conversation was created (count should still be 1)
       $this->assertDatabaseCount('conversations', 1);
   });
   ```

---

## Explanation Summary

* **`UserController@search`**: Uses SQL `LIKE` queries to find users matching the text you typed. It explicitly filters out your own ID so you don't talk to yourself.
* **`ConversationController@store`**: Uses `whereHas` to check the pivot table (`conversation_user`) to see if a conversation linking your ID and their ID already exists.
* **Debounce (`setTimeout`)**: When searching in React, we wait 300 milliseconds after you stop typing to actually send the request. If you type "Ali" very fast, it sends ONE request for "Ali", instead of three separate requests for "A", "Al", "Ali". This is a crucial performance trick!
* **`window.location.reload()`**: Right now, our `store` method just returns a raw `Conversation` model with no user details attached to it. The easiest way to get the fully formatted data for the sidebar is to just reload the page, let `ConversationController@index` format it correctly, and show it!
