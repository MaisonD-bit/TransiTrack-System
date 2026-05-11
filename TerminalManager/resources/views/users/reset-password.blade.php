@extends('layouts.default')

@section('title', 'Reset Password')

@section('content')
<div class="login-container">
    <div class="logo text-center mb-4">
        <h1 class="fw-bold mb-2">Reset Password</h1>
        <div class="subtitle p-2"><p>Enter your new password.</p></div>
    </div>

    <form action="{{ route('password.reset.submit') }}" method="post">
        @csrf
        <input type="hidden" name="email" value="{{ old('email', $email ?? '') }}">
        <input type="hidden" name="token" value="{{ old('token', $token ?? '') }}">

        @if($errors->any())
            <div class="alert alert-danger small">
                Please fix the errors below.
            </div>
        @endif

        <div class="form-group mb-3">
            <label class="form-label fw-semibold">Email</label>
            <input type="email" class="form-control" value="{{ old('email', $email ?? '') }}" disabled>
        </div>

        <div class="form-group mb-3">
            <label for="password" class="form-label fw-semibold">
                <i class="fa-solid fa-lock me-2"></i>New Password
            </label>
            <input
                type="password"
                name="password"
                id="password"
                class="form-control @error('password') is-invalid @enderror"
                placeholder="Enter new password"
                required
            >
            @error('password')
                <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-4">
            <label for="password_confirmation" class="form-label fw-semibold">Confirm Password</label>
            <input
                type="password"
                name="password_confirmation"
                id="password_confirmation"
                class="form-control"
                placeholder="Confirm new password"
                required
            >
        </div>

        @error('token')
            <div class="alert alert-danger small">{{ $message }}</div>
        @enderror

        @error('email')
            <div class="alert alert-danger small">{{ $message }}</div>
        @enderror

        <button type="submit" class="btn btn-primary w-100">
            Reset password
        </button>

        <div class="text-center mt-3">
            <a href="{{ route('login') }}">Back to login</a>
        </div>
    </form>
</div>
@endsection

