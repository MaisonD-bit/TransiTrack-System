@extends('layouts.default')

@section('title', 'Forgot Password')

@section('content')
<div class="login-container">
    <div class="logo text-center mb-4">
        <h1 class="fw-bold mb-2">Forgot Password</h1>
        <div class="subtitle p-2"><p>We’ll email you a reset link.</p></div>
    </div>

    @if(session('success'))
        <div class="alert alert-success small">{{ session('success') }}</div>
    @endif

    <form action="{{ route('password.forgot.send') }}" method="post">
        @csrf
        <div class="form-group mb-3">
            <label for="email" class="form-label fw-semibold">
                <i class="fas fa-envelope me-2"></i>Email
            </label>
            <input
                type="email"
                name="email"
                id="email"
                class="form-control @error('email') is-invalid @enderror"
                value="{{ old('email') }}"
                placeholder="Enter your email"
                required
            >
            @error('email')
                <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <button type="submit" class="btn btn-primary w-100">
            Send reset email
        </button>

        <div class="text-center mt-3">
            <a href="{{ route('login') }}">Back to login</a>
        </div>
    </form>
</div>
@endsection

