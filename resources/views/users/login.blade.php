@extends('layouts.default')

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terminal Operations Manager Registration</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">

    <style>
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .photo-preview {
            width: 100px;
            height: 100px;
            object-fit: cover;
            border-radius: 6px;
            margin-top: 10px;
            display: none;
        }
    </style>
</head>
<body>

<div class="container d-flex justify-content-center align-items-center vh-100">
    <div class="card p-4" style="min-width: 350px; max-width: 400px; width: 100%;">
        <div class="text-center mb-4">
        <i class="fas fa-bus fa-2x text-primary mb-3"></i>
        <h3 class="fw-bold text-dark mb-2">Welcome, Terminal Operations Manager!</h3>
        <div class="badge bg-primary rounded-pill p-2">
            <i class="fas fa-sign-in-alt me-2"></i>Login
        </div>
    </div>
        
        <form action="{{ route('authenticate') }}" method="post">
            @csrf
            <div class="mb-3">
                <label for="email" class="form-label fw-semibold">
                    <i class="fas fa-envelope me-2"></i>Email
                </label>
                <input 
                    type="email" 
                    name="email" 
                    id="email" 
                    class="form-control @error('email') is-invalid @enderror" 
                    value="{{ old('email') }}" 
                    required 
                >
                @error('email')
                <small class="text-danger">{{ $message }}</small>
                @enderror
            </div>

            <div class="mb-4">
                <label for="password" class="form-label fw-semibold">
                    <i class="fa-solid fa-lock me-2"></i>Password
                </label>
                <input 
                    type="password" 
                    name="password" 
                    id="password" 
                    class="form-control @error('password') is-invalid @enderror" 
                    required 
                >
                @error('password')
                <small class="text-danger">{{ $message }}</small>
                @enderror
            </div>

            <div class="d-flex align-items-center justify-content-center">
                <button type="submit" class="btn btn-primary me-2">Login</button>
                <button type="reset" class="btn btn-outline-secondary me-2">Clear</button>
                <a href="{{ route('register') }}">Create an account</a>
            </div>
        </form>
    </div>

</div>

