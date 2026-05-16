<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forgot Password - TransiTrack</title>
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
            max-width: 520px;
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
        <h3 class="mb-2">Forgot Password</h3>
        <p class="text-secondary mb-4">Enter your email. If it exists, we’ll send a reset link.</p>

        @if (session('success'))
            <div class="alert alert-success">{{ session('success') }}</div>
        @endif

        @if ($errors->any())
            <div class="alert alert-danger">
                <ul class="mb-0">
                    @foreach ($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </div>
        @endif

        <form method="POST" action="{{ route('password.forgot.submit') }}">
            @csrf
            <div class="mb-3">
                <label class="form-label">Email</label>
                <input class="form-control" type="email" name="email" value="{{ old('email') }}" required>
            </div>
            <button class="btn btn-primary w-100" type="submit">Send reset email</button>
        </form>

        <div class="text-center mt-3">
            <a href="{{ route('login') }}">Back to login</a>
        </div>
    </div>
</body>
</html>

