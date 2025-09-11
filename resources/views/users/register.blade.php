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

<div class="card p-4 my-5" style="width: 100%; max-width: 420px;">
    <div class="text-center mb-4">
        <i class="fas fa-bus fa-2x text-primary mb-3"></i>
        <h3 class="fw-bold text-dark mb-2">Terminal Operations Manager Registration</h3>
        <div class="badge bg-primary rounded-pill p-2">
            Create your account to manage terminal operations.
        </div>
    </div>

    <form action="{{ route('store') }}" method="post" enctype="multipart/form-data">
        @csrf

        <div class="form-group mb-3">
            <label for="name" class="form-label fw-semibold">
              <i class="fas fa-user me-2"></i>Full Name
            </label>
            <input type="text" name="name" class="form-control" value="{{ old('name') }}">
            @error('name')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-3">
            <label for="email" class="form-label fw-semibold">
              <i class="fas fa-envelope me-2"></i>Email
            </label>
            <input type="email" name="email" class="form-control" value="{{ old('email') }}">
            @error('email')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-3">
            <label for="password" class="form-label fw-semibold">
              <i class="fa-solid fa-lock me-2"></i>Password
            </label>
            <input type="password" name="password" class="form-control">
            @error('password')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-3">
            <label for="password_confirmation" class="form-label fw-semibold">
              <i class="fa-solid fa-lock me-2"></i>Confirm Password
            </label>
            <input type="password" name="password_confirmation" class="form-control">
            @error('password')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-3">
            <label for="contact_number" class="form-label fw-semibold">
              <i class="fa-solid fa-phone me-2"></i>Contact Number
            </label>
            <input type="text" name="contact_number" class="form-control" value="{{ old('contact_number') }}">
            @error('contact_number')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-3">
            <label for="gender" class="form-label fw-semibold">
              <i class="fa-solid fa-person"></i><i class="fa-solid fa-person-dress me-2"></i>Gender
            </label><br>
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="gender" value="male"
                    {{ old('gender') == 'male' ? 'checked' : '' }}>
                <label class="form-check-label">Male</label>
            </div>
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="gender" value="female"
                    {{ old('gender') == 'female' ? 'checked' : '' }}>
                <label class="form-check-label">Female</label>
            </div>
            @error('gender')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <input type="hidden" name="role" value="manager">

        <div class="form-group mb-3">
            <label for="photo" class="form-label fw-semibold">
                <i class="fas fa-camera me-2"></i>Upload Photo
            </label>
            <input type="file"
                   class="form-control @error('photo') is-invalid @enderror"
                   id="photo"
                   name="photo"
                   accept="image/jpeg, image/png, image/jpg"
                   onchange="previewPhoto(event)">
            <small class="text-muted">Allowed formats: JPG, JPEG, PNG. Max size: 2MB</small>
            @error('photo')
            <div class="text-danger">{{ $message }}</div>
            @enderror
            <div class="mt-2 text-center">
                <img id="photoPreview" class="photo-preview" alt="Photo preview">
            </div>
        </div>

        <button type="submit" class="btn btn-primary w-100">Register</button>

        <div class="text-center mt-3">
            <a href="{{ route('login') }}">Already have an account?</a>
        </div>
    </form>
</div>

<script>
    function previewPhoto(event) {
        const preview = document.getElementById('photoPreview');
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            reader.readAsDataURL(file);
        }
    }
</script>
</body>
</html>
