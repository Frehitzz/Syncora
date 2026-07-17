# Phase 2 — Feature 2.4: Search Conversations

In Feature 2.3, we made the send button work — you can now type a message and it saves to the database. But what if you have 50 conversations in your sidebar? Scrolling through all of them to find one person would be annoying.

In this tutorial, we will make the search icon (🔍) on the left sidebar actually work. When you click it, a search input appears. As you type a name, the conversation list filters instantly to show only the conversations that match.

---

## What We Are Building

Right now in `Home.tsx`, there is a search button in the sidebar top bar (lines 262–268). It has a magnifying glass icon but it doesn't do anything when you click it. We are going to:

1. Toggle a search input when the search icon is clicked.
2. Filter the conversation list on the frontend as the user types (no backend needed).
3. Show only conversations whose name matches the search query.
4. Let the user close the search bar and go back to the full list.
5. Write a Pest test that verifies the backend still returns the correct conversations (since the filtering is client-side, we just need to make sure the data is solid).

---

## Why Is This Feature Frontend-Only?

In Feature 2.2 and 2.3, we added backend routes and controllers. But for this feature, we **don't need a new backend endpoint**. Here's why:

When the page loads, Laravel already sends **all** of the user's conversations to React (via the `ConversationController@index` method). Those conversations are already sitting in React's memory as the `conversations` prop. So instead of asking the server to filter them, we can filter them right here in the browser using JavaScript. This is called **client-side filtering**.

**When would you need server-side filtering?** If a user had hundreds or thousands of conversations, sending them all to the frontend would be slow. In that case, you'd create a backend search endpoint. But for now, client-side filtering is faster and simpler.

---

## Step-by-Step Implementation

### Step 1: Add State Variables for Search

We need two new state variables in the `Home` component:
1. A boolean to track whether the search bar is visible or hidden.
2. A string to track what the user has typed in the search bar.

1. Open `resources/js/pages/Home.tsx`.

2. Inside the `Home` component, find the line where we track `newMessage` (around line 126). Right below it, add two new state variables:

```typescript
    // tracks whether the search bar is visible
    const [searchOpen, setSearchOpen] = useState(false);

    // tracks the search query text
    const [searchQuery, setSearchQuery] = useState('');
```

**Why two separate variables?**
- `searchOpen` controls **visibility** — should the search input be shown or hidden?
- `searchQuery` controls **what the user typed** — the text used to filter conversations.

We could use just `searchQuery` (and show the search bar whenever it's not empty), but having a separate `searchOpen` gives us better control. For example, the user might open the search bar, decide not to search, and close it — the search bar would still be visible even though the query is empty.

---

### Step 2: Create the Filtered Conversations List

Right now, the conversation list renders every conversation using `conversations.map(...)`. We need to create a **filtered version** of this list that only includes conversations matching the search query.

3. Below the state variables you just added, add this computed value:

```typescript
    // ======== FILTERED CONVERSATIONS ==========
    // filters the conversation list based on the search query (case-insensitive)
    const filteredConversations = conversations.filter((convo) =>
        convo.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
```

**Let's break this down:**

- **`conversations.filter(...)`** — The `.filter()` method creates a new array that only contains items that pass a test. It loops through every conversation and asks: "Does this one match the search?" If yes, it keeps it. If no, it removes it.
- **`convo.name.toLowerCase()`** — We convert the conversation name to lowercase. This makes the search **case-insensitive**. So if the contact's name is "Alice" and you type "alice" or "ALICE", it will still match.
- **`.includes(searchQuery.toLowerCase())`** — The `.includes()` method checks if one string contains another. So if the name is "Alice Nguyen" and you type "ali", it returns `true` because "alice nguyen" includes "ali".
- **Why not use `===`?** Because `===` checks for an exact match. If the contact's name is "Alice Nguyen" and you type "Alice", `===` would return `false` because "Alice" is not exactly "Alice Nguyen". `.includes()` is much more user-friendly — it matches partial text.

**Important:** We are NOT modifying the original `conversations` array. `.filter()` creates a **new** array. The original stays untouched. This is important in React — you should never directly modify props.

**When `searchQuery` is empty (`''`):**
Every string `.includes('')` returns `true`. So when the search bar is empty or closed, `filteredConversations` will contain ALL conversations — exactly what we want.

---

### Step 3: Make the Search Button Toggle the Search Bar

Right now the search button does nothing. We need to make it toggle the search bar open and closed.

4. Find the search button in the JSX (around line 262). Replace the existing search button with:

```tsx
{/* Search Button */}
<button
    onClick={() => {
        setSearchOpen(!searchOpen);
        if (searchOpen) {
            setSearchQuery('');
        }
    }}
    aria-label="Search conversations"
    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
        ${searchOpen
            ? 'text-accent dark:text-accent-alt bg-accent/10 dark:bg-accent-alt/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/40'
        }`}
>
    <Search className="w-4 h-4" />
</button>
```

**What changed and why:**

- **`onClick={() => { setSearchOpen(!searchOpen); ... }}`** — When you click the button, it flips the `searchOpen` state. If it's `false` (closed), it becomes `true` (open). If it's `true` (open), it becomes `false` (closed). The `!` is the "not" operator — it flips a boolean.
- **`if (searchOpen) { setSearchQuery(''); }`** — When the user is **closing** the search bar (it was open, now they click to close), we clear the search query. This resets the filter so all conversations show up again. Without this, the list would stay filtered even after the search bar disappears.
- **Dynamic styling** — When the search is active (`searchOpen` is `true`), the button gets a highlighted color (`text-accent` with a subtle background). This gives the user a visual indicator that search mode is active. When it's inactive, it looks like a normal muted button.

---

### Step 4: Add the Search Input Bar

We need to add a search input that slides in below the "Messages" header when `searchOpen` is `true`.

5. Find the closing `</div>` of the "Left Top Bar" section (around line 277). Right below it, add the search input bar:

```tsx
{/* Search Input Bar — slides in when search is active */}
{searchOpen && (
    <div className="flex-shrink-0 px-4 py-2 border-b border-border">
        <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 text-sm font-sans rounded-lg bg-muted/50 dark:bg-muted/20 border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-accent dark:focus:border-accent-alt focus:ring-1 focus:ring-accent/20 transition-all"
        />
    </div>
)}
```

**Let's break this down:**

- **`{searchOpen && (...)}`** — This is **conditional rendering** in React. It means: "Only render this JSX if `searchOpen` is `true`." When `searchOpen` is `false`, this entire block disappears from the page. It's like an `if` statement for HTML.
- **`value={searchQuery}`** — This connects the input to our state variable, making it a **controlled input** (same pattern we used for the message input in Feature 2.3).
- **`onChange={(e) => setSearchQuery(e.target.value)}`** — Every time the user types a character, this updates the `searchQuery` state. Because `filteredConversations` depends on `searchQuery`, React automatically re-calculates the filtered list and re-renders the conversation list. This is why the filtering feels instant — React does it on every keystroke.
- **`autoFocus`** — When the search bar appears, the cursor automatically goes into the input so the user can start typing immediately. Without this, they'd have to click on the input first.
- **The styling** — We use the same design language as the message input (muted background, border, accent focus ring) so it feels consistent with the rest of the app.

---

### Step 5: Use `filteredConversations` Instead of `conversations`

Right now, the conversation list renders ALL conversations. We need to switch it to render only the filtered ones.

6. Find the conversation list section (around line 284). Change `conversations.map` to `filteredConversations.map`:

Find this code:
```tsx
{conversations.map((convo) => (
```

Replace it with:
```tsx
{filteredConversations.map((convo) => (
```

**Why this works:**
- When the search bar is closed or empty, `filteredConversations` contains every conversation (because every string includes `''`). So the list looks exactly the same as before.
- When the user types something, `filteredConversations` only contains the conversations whose names match. React automatically re-renders the list with fewer items.
- We only change one word (`conversations` → `filteredConversations`) and the entire search feature works. This is the power of React's reactive system — when data changes, the UI updates automatically.

---

### Step 6: Add a "No Results" Message

What if the user searches for a name that doesn't exist? The sidebar would be completely empty with no explanation. Let's add a friendly message.

7. Update the conversation list section to show a message when there are no results. Replace the entire conversation list `<div>` with:

```tsx
{/* Conversation List 
    - it display each convo on the left sidebar by the map().
    - if user click each convo it will display the messaes of the convo by running selectConversation
*/}
<div className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin">
    {filteredConversations.length > 0 ? (
        filteredConversations.map((convo) => (
            <div key={convo.id} onClick={() => selectConversation(convo)}>
                <ConversationItem
                    convo={convo}
                    active={activeConvo !== null && convo.id === activeConvo.id}
                />
            </div>
        ))
    ) : (
        <p className="text-center text-sm text-muted-foreground font-sans py-8">
            {searchOpen ? 'No conversations found.' : 'No conversations yet.'}
        </p>
    )}
</div>
```

**What changed:**

- **`filteredConversations.length > 0 ? (...) : (...)`** — This is a ternary operator (like a compact if/else). If there are conversations to show, render them. If not, show a message.
- **`searchOpen ? 'No conversations found.' : 'No conversations yet.'`** — If the search bar is open and there are no results, we say "No conversations found." (meaning the search didn't match anything). If the search bar is closed and there are no conversations at all, we say "No conversations yet." (meaning the user has no conversations). This gives the user the right context for why the list is empty.

---

### Step 7: Write the Pest Test

Since the search filtering happens entirely on the frontend (client-side JavaScript), we can't directly test the filtering logic with a PHP test. However, we should still test that the backend correctly sends all conversations to the frontend — because if the data is wrong, the search won't work either.

We already have a basic test in `ConversationControllerTest.php` that checks one conversation loads. Let's add a test with multiple conversations to make sure all of them arrive at the frontend.

1. Open `tests/Feature/ConversationControllerTest.php`.

2. Add this new test at the bottom of the file:

```php
test('all conversations are sent to the frontend for client-side search', function () {
    // 1. ARRANGE: create a user with multiple conversations
    /** @var \App\Models\User $user */
    $user = User::factory()->create();

    /** @var \App\Models\User $alice */
    $alice = User::factory()->create(['name' => 'Alice Nguyen']);

    /** @var \App\Models\User $bob */
    $bob = User::factory()->create(['name' => 'Bob Smith']);

    /** @var \App\Models\User $charlie */
    $charlie = User::factory()->create(['name' => 'Charlie Brown']);

    // Create 3 conversations with different users
    $convo1 = Conversation::create();
    $convo1->users()->attach([$user->id, $alice->id]);

    $convo2 = Conversation::create();
    $convo2->users()->attach([$user->id, $bob->id]);

    $convo3 = Conversation::create();
    $convo3->users()->attach([$user->id, $charlie->id]);

    // 2. ACT: request the dashboard
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->get(route('dashboard'));

    // 3. ASSERT: all 3 conversations are sent to the frontend
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('Home')
        ->has('conversations', 3)
    );
});
```

**Why this test matters:**

- The search feature depends on the frontend having ALL conversations available. If the backend only sends 10 out of 50 conversations, the user wouldn't be able to search for the missing 40.
- This test creates 3 conversations and verifies all 3 are passed to the `Home` component as props. If someone accidentally adds a `->limit(10)` to the backend query in the future, this test would catch it.
- We use `->has('conversations', 3)` to check the exact count. This is stricter than just checking if the page loads.

---

### Step 8: Run the Tests

After writing all the code, verify everything works:

1. Run the conversation controller tests:
   ```bash
   php artisan test --filter=ConversationControllerTest
   ```

2. You should see all tests passing:
   ```
   PASS  Tests\Feature\ConversationControllerTest
   ✓ logged in user can view their conversations in the sidebar
   ✓ all conversations are sent to the frontend for client-side search
   ```

3. Also run the lint and type checks:
   ```bash
   npm run lint && npm run types:check
   ```

---

### Step 9: Test It Manually

1. Make sure your dev server is running:
   ```bash
   php artisan serve
   ```
   And in another terminal:
   ```bash
   npm run dev
   ```

2. Log in and go to the dashboard.

3. Click the **search icon** (🔍) at the top of the left sidebar. A search input should appear below the "Messages" heading.

4. Type a name — the conversation list should filter instantly as you type. Only conversations with matching names should appear.

5. Clear the search input — all conversations should reappear.

6. Click the search icon again — the search bar should disappear and all conversations should be visible.

---

## Summary of Changes

| File | What Changed |
|------|-------------|
| `resources/js/pages/Home.tsx` | Added `searchOpen` and `searchQuery` state, `filteredConversations` computed value, toggle on search button, search input bar, "no results" message |
| `tests/Feature/ConversationControllerTest.php` | Added test to verify all conversations are sent to the frontend |

---

## How the Full Flow Works

Here's what happens when you search for "Alice":

1. **You click the search icon** → `setSearchOpen(true)` runs → the search input appears with `autoFocus`.
2. **You type "A"** → `setSearchQuery('A')` runs → React re-calculates `filteredConversations`.
3. **`filteredConversations` runs** → It loops through all conversations and checks: does each name include "a" (lowercase)? "Alice Nguyen" → yes. "Bob Smith" → no. "Charlie Brown" → no.
4. **React re-renders** → Only "Alice Nguyen" appears in the sidebar. Bob and Charlie disappear.
5. **You type "Al"** → Same process. Only names containing "al" appear.
6. **You clear the input** → `searchQuery` becomes `''` → every name includes `''` → all conversations reappear.
7. **You click the search icon again** → `setSearchOpen(false)` runs → `setSearchQuery('')` clears the filter → search bar disappears → full list is back.
