<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>TransiTrack - @yield('title')</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
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

        .register-container {
            background: var(--card-bg);
            border-radius: 15px;
            padding: 2rem;
            box-shadow: 0 10px 30px var(--shadow);
            margin-top: 20px;
            margin-bottom: 20px;
            width: 650px;
            max-width: 100%;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(65, 86, 119, 0.3);
        }

        .login-container {
            background: var(--card-bg);
            border-radius: 15px;
            padding: 2rem;
            box-shadow: 0 10px 30px var(--shadow);
            margin-top: 20px;
            margin-bottom: 20px;
            width: 650px;
            max-width: 100%;
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

        .photo-preview {
            width: 100px;
            height: 100px;
            object-fit: cover;
            border-radius: 6px;
            margin-top: 10px;
            display: none;
        }
        
        h1 {
            font-weight: 700;
            color: var(--text-light);
            margin-bottom: 0.5rem;
        }

        label {
            font-weight: 500;
            color: var(--text-light);
        }

        .register-container .subtitle p,
        .login-container .subtitle p {
            color: #adb5bd;
            margin-bottom: 1rem;
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

        .register-container .text-center a,
        .login-container .text-center a {
            color: var(--accent);
            text-decoration: none;
            font-weight: 500;
        }

        .register-container .text-center a:hover,
        .login-container .text-center a:hover {
            text-decoration: underline;
        }

        .form-group {
            margin-bottom: 1rem;
        }

        .form-label {
            font-weight: 500;
            color: var(--text-light);
        }

        .form-control {
            background-color: var(--input-bg);
            border: 1px solid var(--input-border);
            color: var(--text-light);
            border-radius: 8px;
            padding: 0.75rem 1rem;
            transition: border-color 0.3s ease;
        }

        .form-control:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(58, 134, 255, 0.2);
            outline: none;
            background-color: var(--input-bg);
            color: var(--text-light);
        }

        .form-control::placeholder {
            color: #6c757d;
            opacity: 1;
        }

        small {
            color: #adb5bd;
        }

        .footer {
            text-align: center;
            margin-top: 2rem;
            font-size: 0.8rem;
            color: #adb5bd;
        }

        .photo-upload-section {
            text-align: center;
            margin: 2rem 0;
        }

        .photo-preview-container {
            position: relative;
            display: inline-block;
            margin: 0 auto;
        }

        .photo-preview {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            border: 3px solid var(--accent);
            object-fit: cover;
            background-color: var(--input-bg);
            margin: 0 auto 1rem;
            display: none;
        }

        .photo-upload-btn {
            background-color: var(--accent);
            color: white;
            border: none;
            border-radius: 20px;
            padding: 0.5rem 1rem;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.3s ease;
        }

        .photo-upload-btn:hover {
            background-color: #3071a9;
        }

        .photo-upload-input {
            display: none;
        }

        .required {
            color: var(--text-light);
        }

    </style>

</head>

<body>
    <div class="main-content">
        @yield('content')
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>

</html>