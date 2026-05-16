<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - TransiTrack</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        :root {
            --primary-dark: #0d1b2a;
            --primary-medium: #1b263b;
            --primary-light: #415a77;
            --accent: #3a86ff;
            --text-light: #e0e1dd;
            --input-bg: #1b263b;
            --input-border: #415a77;
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
        .cardish {
            background: var(--primary-medium);
            border: 1px solid rgba(65, 86, 119, 0.6);
            border-radius: 15px;
            padding: 2rem;
            width: 100%;
            max-width: 560px;
        }
        .form-control {
            background-color: var(--input-bg);
            border: 1px solid var(--input-border);
            color: var(--text-light);
        }
        .btn-primary { background-color: var(--accent); border: none; }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="cardish">
        <h3 class="mb-2">Reset Password</h3>
        <p class="text-secondary mb-4">Set a new password for your account.</p>

        @if ($errors->any())
            <div class="alert alert-danger">
                <ul class="mb-0">
                    @foreach ($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </div>
        @endif

        <form method="POST" action="{{ route('password.reset.submit') }}">
            @csrf
            <input type="hidden" name="role" value="{{ old('role', $role ?? 'operator') }}">
            <input type="hidden" name="email" value="{{ old('email', $email ?? '') }}">
            <input type="hidden" name="token" value="{{ old('token', $token ?? '') }}">

            <div class="mb-3">
                <label class="form-label">Email</label>
                <input class="form-control" type="email" value="{{ old('email', $email ?? '') }}" disabled>
            </div>

            <div class="mb-3">
                <label class="form-label">New Password</label>
                <input class="form-control" type="password" name="password" required minlength="8">
            </div>

            <div class="mb-3">
                <label class="form-label">Confirm Password</label>
                <input class="form-control" type="password" name="password_confirmation" required minlength="8">
            </div>

            <button class="btn btn-primary w-100" type="submit">Reset password</button>
        </form>

        <div class="text-center mt-3">
            <a href="{{ route('login') }}">Back to login</a>
        </div>
    </div>
</body>
</html>

