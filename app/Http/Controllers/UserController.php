<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    // ========= SEARCH =========
    // finds users matching the search query, excluding the currently logged in user
    public function search(Request $request): JsonResponse
    {
        $query = $request->input('query');

        // if the search box is empty, return an empty array
        if (! $query) {
            return response()->json([]);
        }

        /** @var User $user */
        $user = $request->user();

        // search the database for names or emails that match, but dont include ourselves!
        $users = User::query()
            ->where('id', '!=', $user->id)
            ->where(function (Builder $q) use ($query) {
                $q->where('name', 'like', '%'.$query.'%')
                    ->orWhere('email', 'like', '%'.$query.'%');
            })
            ->limit(10) // only display 10 result, so frontend will not overload
            ->get(['id', 'name', 'email']);

        return response()->json($users);
    }
}
