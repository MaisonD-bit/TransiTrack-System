@extends('layouts.default')

@section('title', 'Login')

@section('content')

<div class="login-container">
    <div class="logo text-center mb-4">
        <img src="{{ asset('images/transitrack_logo.png') }}" alt="TransiTrack Logo" class="logo-img">
        <h1 class="fw-bold mb-2">TransiTrack</h1>
        <div class="subtitle p-2"><p>Terminal Operations Management System</p></div>
    </div>
        
    @if(session('success'))
        <div class="alert alert-success small">{{ session('success') }}</div>
    @endif

    <form action="{{ route('authenticate') }}" method="post">
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
            >
            @error('email')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-4">
            <label for="password" class="form-label fw-semibold">
                <i class="fa-solid fa-lock me-2"></i>Password
            </label>
            <input 
                type="password" 
                name="password" 
                id="password" 
                class="form-control @error('password') is-invalid @enderror"
                placeholder="Enter your password" 
            >
            @error('password')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <button type="submit" class="btn btn-primary w-100">
            <i class="fas fa-sign-in-alt me-2"></i>Login
        </button>

        <div class="text-center mt-3">
            <a href="{{ route('password.forgot') }}">Forgot password?</a>
        </div>
        
        <div class="text-center mt-3">
            <p>Don't have an account? <a href="{{ route('register') }}">Register here</a></p>
        </div>
    </form>

    <div class="footer mt-4">
        North & South Terminal Operations • Cebu, Philippines
    </div>
</div>

<div class="modal fade" id="authErrorModal" tabindex="-1" aria-labelledby="authErrorModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="background-color: var(--card-bg); border: 1px solid var(--input-border);">
            <div class="modal-header border-0">
                <h5 class="modal-title text-danger" id="authErrorModalLabel">
                    <i class="fas fa-exclamation-triangle me-2"></i>Access Denied
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body text-center">
                <p class="mb-0" style="color: var(--text-light);">Only terminal managers are authorized to access.</p>
            </div>
            <div class="modal-footer border-0">
                <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
            </div>
        </div>
    </div>
</div>

@if($errors->has('email') && str_contains($errors->first('email'), 'managers'))
<script>
    document.addEventListener('DOMContentLoaded', function() {
        var authErrorModal = new bootstrap.Modal(document.getElementById('authErrorModal'));
        authErrorModal.show();
    });
</script>
@endif

@endsection