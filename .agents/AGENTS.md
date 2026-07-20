# Project Rules

## Function Commenting Rule
Whenever you create or edit a function—especially main page components, primary UI containers, and sub-components—you must document it with a header comment describing its purpose. 

Use the following exact format, inserting the human-readable function name:

```typescript
// ========== [Function Name] ===========
// [Brief description of what the function does]
```

## PHPStan Generic Type Rule for Eloquent Relationships
Whenever you write or edit database relationships in Eloquent models, you must specify the generic return types inside the PHPDoc block above the function, along with the standard return type declaration. This is required for Larastan/PHPStan static analysis compliance.

Use the following format matching the relationship type:
- **BelongsTo**: `@return \Illuminate\Database\Eloquent\Relations\BelongsTo<RelatedModel, $this>`
- **HasMany**: `@return \Illuminate\Database\Eloquent\Relations\HasMany<RelatedModel, $this>`
- **BelongsToMany**: `@return \Illuminate\Database\Eloquent\Relations\BelongsToMany<RelatedModel, $this>`

Example:
```php
    /**
     * Get the users that are part of this conversation
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany<User, $this>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }
```

## Inline Type Hinting Rule
Whenever assigning variables that Laravel magic or Pest PHP makes difficult for static analysis tools (like PHPStan or Intelephense) to infer, you must add an inline PHPDoc type hint above the variable.

Common scenarios include:
- `$user = $request->user();` -> `/** @var \App\Models\User $user */`
- Pest's `$this` variable -> `/** @var \Tests\TestCase $this */`
- Model factories -> `/** @var \App\Models\User $user */`

Example:
```php
    /** @var \Tests\TestCase $this */
    $response = $this->actingAs($user)->get(route('dashboard'));
```

## CI Testing Rule (Frontend Linting & Backend Testing)
To avoid CI errors, you MUST run the appropriate testing/linting commands before committing any changes:
- For frontend (React/TypeScript) changes, run: `npm run lint`
- For backend (PHP/Laravel) changes, run: `php artisan test` or `composer test`
Always fix any ESLint warnings or failing tests before creating a commit.

# Repository Guidelines

## Project Structure & Module Organization

This is a Laravel 13 application with an Inertia React frontend. Backend code lives in `app/`: controllers in `app/Http/Controllers`, requests in `app/Http/Requests`, models in `app/Models`, and providers in `app/Providers`. Routes are split across `routes/web.php`, `routes/settings.php`, and `routes/console.php`.

Frontend code lives in `resources/js`: pages, components, layouts, hooks, and shared types each have dedicated folders. Styles are in `resources/css/app.css`; public images are in `public/`. Database migrations, factories, and seeders are in `database/`. Tests are in `tests/Feature` and `tests/Unit`.

## Build, Test, and Development Commands

- `composer setup`: install PHP and Node dependencies, create `.env`, generate the app key, run migrations, and build assets.
- `composer dev`: run the Laravel server, queue listener, and Vite dev server together.
- `npm run dev`: start only the Vite frontend dev server.
- `npm run build`: build production frontend assets.
- `composer test`: clear config, run Pint/PHPStan checks, then run the Laravel test suite.
- `php artisan test`: run Pest/PHPUnit tests only.
- `composer ci:check`: run frontend lint/format/type checks plus backend tests.

## Coding Style & Naming Conventions

Use Laravel conventions for PHP: PSR-4 classes under `App\`, singular models such as `Conversation`, and descriptive controllers such as `MessageController`. PHP formatting uses Laravel Pint with the `laravel` preset; run `composer lint` before committing PHP changes.

TypeScript and React code use ESLint, Prettier, and Tailwind class sorting. Prefer type imports, alphabetized import groups, functional components, PascalCase component files, and camelCase hooks such as `useFlashToast`.

## Testing Guidelines

The project uses Pest on PHPUnit. Place HTTP and workflow coverage in `tests/Feature`, and isolated logic tests in `tests/Unit`. Name test files after the subject, for example `ConversationControllerTest.php` or `SecurityTest.php`. Tests use in-memory SQLite from `phpunit.xml`, so create data with factories and avoid local database assumptions.

## Commit & Pull Request Guidelines

Recent commits use concise Conventional Commit-style subjects, especially `feat: ...`. Follow that pattern with imperative summaries such as `feat: add conversation search` or `fix: validate chat request recipient`.

Pull requests should include a short description, linked issue when applicable, screenshots for UI changes, migration notes for database changes, and the commands run to verify the work.

## Security & Configuration Tips

Do not commit `.env`, generated secrets, or local database files. Keep authentication and two-factor changes covered by feature tests. Prefer Laravel validation requests for user input and policies or controller checks for authorization-sensitive workflows.
