<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - TransiTrack</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        :root {
            --primary-dark: #0d1b2a;
            --primary-medium: #1b263b;
            --primary-light: #415a77;
            --accent: #3a86ff;
            --text-light: #e0e1dd;
            --text-dark: #1b263b;
            --input-bg: #1b263b;
            --input-border: #415a77;
            --card-bg: rgba(27, 38, 59, 0.8);
            --shadow: rgba(0, 0, 0, 0.5);
        }

        body {
            background: linear-gradient(135deg, var(--primary-dark), var(--primary-medium));
            min-height: 100vh;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: var(--text-light);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .login-container {
            background: var(--card-bg);
            margin-top: 20px;
            margin-bottom: 20px;
            border-radius: 15px;
            padding: 2rem;
            box-shadow: 0 10px 30px var(--shadow);
            width: 100%;
            max-width: 650px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(65, 86, 119, 0.3);
        }

        .logo {
            text-align: center;
            margin-bottom: 1.5rem;
        }

        .logo-img {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: rgba(58, 134, 255, 0.1);
            padding: 10px;
            margin: 0 auto 1rem;
            display: block;
            object-fit: contain;
        }

        h1 {
            font-weight: 700;
            color: var(--text-light);
            margin-bottom: 0.5rem;
        }

        p.subtitle {
            color: #adb5bd;
            margin-bottom: 2rem;
        }

        .input-group-text {
            background-color: var(--input-bg);
            border: 1px solid var(--input-border);
            border-right: none;
            color: var(--text-light); 
        }

        .input-group-text i {
            color: var(--text-light) !important;
        }

        .form-control {
            background-color: var(--input-bg);
            border: 1px solid var(--input-border);
            color: var(--text-light); 
            border-radius: 0 8px 8px 0;
            padding: 0.75rem 1rem;
            transition: border-color 0.3s ease;
        }

        .form-control::placeholder {
            color: #adb5bd !important;
            opacity: 1;
        }

        .form-control:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(58, 134, 255, 0.2);
            outline: none;
            background-color: var(--input-bg);
            color: var(--text-light);
        }

        .form-control:focus::placeholder {
            color: #6c757d; 
        }

        .form-check-input:checked {
            background-color: var(--accent);
            border-color: var(--accent);
        }

        .form-check-input {
            background-color: var(--input-bg);
            border-color: var(--input-border);
        }

        .form-check-label {
            color: var(--text-light); 
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-label {
            font-weight: 500;
            color: var(--text-light);
        }

        .btn-primary {
            background-color: var(--accent);
            border: none;
            border-radius: 8px;
            padding: 0.75rem;
            font-weight: 600;
            transition: background-color 0.3s ease, transform 0.2s ease;
            width: 100%;
        }

        .btn-primary:hover {
            background-color: #3071a9;
            transform: translateY(-1px);
        }

        .links {
            text-align: center;
            margin-top: 1.5rem;
            font-size: 0.9rem;
        }

        .links a {
            color: var(--accent);
            text-decoration: none;
            font-weight: 500;
        }

        .links a:hover {
            text-decoration: underline;
        }

        .footer {
            text-align: center;
            margin-top: 2rem;
            font-size: 0.8rem;
            color: #adb5bd;
        }

        .alert {
            border-radius: 8px;
            margin-bottom: 1.5rem;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <img src="{{ asset('images/transitrack_logo.png') }}" alt="TransiTrack Logo" class="logo-img">
            <h1>TransiTrack</h1>
            <p class="subtitle">Bus Operator Management System</p>
        </div>

        <!-- Success Messages -->
        @if (session('success'))
            <div class="alert alert-success alert-dismissible fade show" role="alert">
                <i class="fas fa-check-circle me-2"></i>
                {{ session('success') }}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        @endif

        <!-- Error Messages -->
        @if ($errors->any())
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <ul class="mb-0">
                    @foreach ($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        @endif

        <form method="POST" action="{{ route('login.post') }}">
            @csrf

            <div class="form-group">
                <label for="email" class="form-label">Email Address</label>
                <div class="input-group">
                    <span class="input-group-text">
                        <i class="fas fa-envelope"></i>
                    </span>
                    <input type="email" 
                           class="form-control @error('email') is-invalid @enderror" 
                           id="email" 
                           name="email" 
                           value="{{ old('email') }}" 
                           placeholder="Enter your Email" 
                           required>
                </div>
                @error('email')
                    <div class="text-danger mt-1">{{ $message }}</div>
                @enderror
            </div>

            <div class="form-group">
                <label for="password" class="form-label">Password</label>
                <div class="input-group">
                    <span class="input-group-text">
                        <i class="fas fa-lock"></i>
                    </span>
                    <input type="password" 
                           class="form-control @error('password') is-invalid @enderror" 
                           id="password" 
                           name="password" 
                           placeholder="Enter your password" 
                           required>
                </div>
                @error('password')
                    <div class="text-danger mt-1">{{ $message }}</div>
                @enderror
            </div>

            <div class="form-group">
                <div class="form-check">
                    <input type="checkbox" 
                           class="form-check-input" 
                           id="remember" 
                           name="remember"
                           {{ old('remember') ? 'checked' : '' }}>
                    <label class="form-check-label" for="remember">Remember me</label>
                </div>
            </div>

            <button type="submit" class="btn btn-primary">
                <i class="fas fa-sign-in-alt me-2"></i>Sign In
            </button>

            <div class="links mt-3">
                <a href="javascript:void(0)" onclick="openForgotPasswordModal()">Forgot password?</a>
                <span class="mx-2">•</span>
                Don't have an account? <a href="{{ route('register') }}">Register here</a>
            </div>
        </form>

        <div class="footer mt-4">
            North & South Terminal Operations • Cebu, Philippines
        </div>
    </div>

    <!-- Forgot Password Modal -->
    <div class="modal fade" id="forgotPasswordModal" tabindex="-1" aria-labelledby="forgotPasswordModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" style="background-color: var(--primary-medium); border: 1px solid var(--input-border);">
                <div class="modal-header border-0">
                    <h5 class="modal-title" id="forgotPasswordModalLabel" style="color: var(--text-light);">
                        <i class="fas fa-key me-2"></i>Forgot Password
                    </h5>
                </div>
                <div class="modal-body">
                    <p class="small" style="color: #adb5bd;">Enter your email. If it exists, we’ll send a reset link.</p>
                    <div class="mb-3">
                        <label class="form-label" style="color: var(--text-light);">Email</label>
                        <input type="email" class="form-control" id="forgotEmail" placeholder="Enter your email">
                    </div>
                    <div class="alert alert-success d-none" id="forgotSuccess">If your email exists, a reset link was sent.</div>
                    <div class="alert alert-danger d-none" id="forgotError">Failed to send reset email.</div>
                </div>
                <div class="modal-footer border-0">
                    <button type="button" class="btn btn-primary" onclick="submitForgotPassword()">Send reset email</button>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        function openForgotPasswordModal() {
            const modal = new bootstrap.Modal(document.getElementById('forgotPasswordModal'));
            document.getElementById('forgotEmail').value = '';
            document.getElementById('forgotSuccess').classList.add('d-none');
            document.getElementById('forgotError').classList.add('d-none');
            modal.show();
        }

        async function submitForgotPassword() {
            const email = (document.getElementById('forgotEmail').value || '').trim();
            if (!email) return;

            const successEl = document.getElementById('forgotSuccess');
            const errorEl = document.getElementById('forgotError');
            successEl.classList.add('d-none');
            errorEl.classList.add('d-none');

            try {
                const res = await fetch('/api/v1/password/forgot', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ role: 'operator', email })
                });

                if (!res.ok) throw new Error('Request failed');
                successEl.classList.remove('d-none');
            } catch (e) {
                errorEl.classList.remove('d-none');
            }
        }
    </script>
</body>
</html>