<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class RentalManagementController extends Controller
{
    public function index()
    {

        return view('operations.rental-management');
    }
}
