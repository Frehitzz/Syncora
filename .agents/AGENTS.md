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
