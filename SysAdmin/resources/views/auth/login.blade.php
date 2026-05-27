<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>TransiTrack — Sysadmin Login</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    @vite(['resources/css/app.css'])
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        :root {
            --primary-dark: #0d1b2a;
            --primary-medium: #1b263b;
            --text-light: #e0e1dd;
            --input-bg: #1b263b;
            --input-border: #415a77;
            --card-bg: rgba(27, 38, 59, 0.8);
            --shadow: rgba(0, 0, 0, 0.5);
        }

        body {
            background: linear-gradient(135deg, var(--primary-dark), var(--primary-medium));
        }

        .sysadmin-login-card {
            background: var(--card-bg);
            border: 1px solid rgba(65, 86, 119, 0.3) !important;
            border-radius: 15px;
            box-shadow: 0 10px 30px var(--shadow) !important;
            backdrop-filter: blur(10px);
        }

        .sysadmin-login-card h1,
        .sysadmin-login-card .form-label,
        .sysadmin-login-card .form-check-label {
            color: var(--text-light);
        }

        .sysadmin-login-card .text-muted {
            color: #adb5bd !important;
        }

        .sysadmin-login-card .form-control {
            background-color: var(--input-bg);
            border-color: var(--input-border);
            color: var(--text-light);
        }

        .sysadmin-login-card .form-control:focus {
            background-color: var(--input-bg);
            border-color: #3a86ff;
            box-shadow: 0 0 0 3px rgba(58, 134, 255, 0.2);
            color: var(--text-light);
        }
    </style>
</head>
<body class="d-flex align-items-center justify-content-center min-vh-100">
    <div class="card shadow-lg border-0 sysadmin-login-card" style="width: 100%; max-width: 420px;">
        <div class="card-body p-5">
            <div class="text-center mb-4">
                <i class="fas fa-user-shield fa-3x text-primary mb-3"></i>
                <h1 class="h4 fw-bold mb-0">TransiTrack Sysadmin</h1>
                <p class="text-muted small mb-0">Approve route pathways &amp; bus stops</p>
            </div>
            @if ($errors->any())
                <div class="alert alert-danger small">{{ $errors->first() }}</div>
            @endif
            <form method="POST" action="{{ route('sysadmin.login.store') }}">
                @csrf
                <div class="mb-3">
                    <label class="form-label">Email</label>
                    <input type="email" name="email" value="{{ old('email') }}" class="form-control" required autofocus>
                </div>
                <div class="mb-3">
                    <label class="form-label">Password</label>
                    <input type="password" name="password" class="form-control" required>
                </div>
                <div class="form-check d-flex align-items-center gap-2 ps-0 mb-3">
                    <input type="checkbox" name="remember" class="form-check-input m-0" id="remember">
                    <label class="form-check-label" for="remember">Remember me</label>
                </div>
                <button type="submit" class="btn btn-primary w-100 py-2">Sign in</button>
            </form>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
