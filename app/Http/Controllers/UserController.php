<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\User;

class UserController extends Controller
{
    // ========= SEARCH =========
    // finds users matching the search query, excluding the currently logged in user
    public function search(Request $request): JsonResponse
    {
        $query = $request->input('query');

        // if the search box is empty, return an empty array
        if(!$query){
            return response()->json([]);
        }

        /** @var \App\Models\User $user */
        $user = $request->user();

        
        // search the database for names or emails that match, but dont include ourselves!
        $users = User::query()
            ->where('id', '!=', $user->id)
            ->where(function (\Illuminate\Database\Eloquent\Builder $q) use ($query){
                $q->where('name', 'like','%' . $query . '%')
                  ->orWhere('email','like','%' . $query . '%');
            })
            ->limit(10) // only display 10 result, so frontend will not overload
            ->get(['id', 'name', 'email']);

        return response()->json($users);
    }
}
