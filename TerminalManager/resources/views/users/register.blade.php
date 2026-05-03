@extends('layouts.default')

@section('title', 'Register')

@section('content')

<div class="register-container">
    <div class="logo text-center mb-4">
        <img src="{{ asset('images/transitrack_logo.png') }}" alt="TransiTrack Logo" class="logo-img">
        <h1 class="fw-bold mb-2">TransiTrack</h1>
        <div class="subtitle p-2"><p>Register your account to manage terminal operations.</p></div>
    </div>

    <form action="{{ route('store') }}" method="post" enctype="multipart/form-data">
        @csrf

        <div class="photo-upload-section">
            <div class="photo-preview-container">
                <img id="photoPreview" class="photo-preview" src="#" alt="Photo Preview">
                <label for="photo" class="photo-upload-btn">
                    <i class="fas fa-camera me-1"></i> Upload Photo
                </label>
                <input type="file"
                        id="photo"
                        name="photo"
                        class="photo-upload-input"
                        accept="image/jpeg, image/png, image/jpg"
                        onchange="previewImage(event)">
            </div>
            <small class="d-block mt-2">Allowed formats: JPG, JPEG, PNG. Max size: 2MB</small>
            @error('photo')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-3">
                <label for="terminal" class="form-label fw-semibold"><i class="fas fa-map-marker-alt me-2"></i>Select Terminal</label>
                <label class="required" for="required">*</label>
                <select name="terminal"
                        id="terminal"
                        class="terminal-select form-control"
                        required>
                    <option value="" disabled selected>-- Choose your operating terminal --</option>
                    <option value="north">North Terminal (SM City)</option>
                    <option value="south">South Terminal</option>
                </select>
        </div>

        <div class="form-group mb-3">
            <label for="first_name" class="form-label fw-semibold">
            <i class="fas fa-user me-2"></i>First Name
            </label>
            <label class="required" for="required">*</label>
            <input type="text" name="first_name" class="form-control" value="{{ old('first_name') }}" placeholder="Ben">
            @error('first_name')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-3">
            <label for="last_name" class="form-label fw-semibold">
            <i class="fas fa-user me-2"></i>Last Name
            </label>
            <label class="required" for="required">*</label>
            <input type="text" name="last_name" class="form-control" value="{{ old('last_name') }}" placeholder="Milton">
            @error('last_name')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-3">
            <label for="email" class="form-label fw-semibold">
            <i class="fas fa-envelope me-2"></i>Email
            </label>
            <label class="required" for="required">*</label>
            <input type="email" name="email" class="form-control" value="{{ old('email') }}" placeholder="youremail@sample.com">
            @error('email')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-3">
            <label for="password" class="form-label fw-semibold">
            <i class="fa-solid fa-lock me-2"></i>Password
            </label>
            <label class="required" for="required">*</label>
            <input type="password" name="password" class="form-control" placeholder="Create a strong password">
            @error('password')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-3">
            <label for="password_confirmation" class="form-label fw-semibold">
            <i class="fa-solid fa-lock me-2"></i>Confirm Password
            </label>
            <label class="required" for="required">*</label>
            <input type="password" name="password_confirmation" class="form-control" placeholder="Confirm your password">
            @error('password_confirmation')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-3">
            <label for="contact_number" class="form-label fw-semibold">
            <i class="fa-solid fa-phone me-2"></i>Contact Number
            </label>
            <label class="required" for="required">*</label>
            <input type="text" name="contact_number" class="form-control" value="{{ old('contact_number') }}" placeholder="09123456789">
            @error('contact_number')
            <small class="text-danger">{{ $message }}</small>
            @enderror
        </div>

        <div class="form-group mb-3">
            <label for="gender" class="form-label fw-semibold">
            <i class="fa-solid fa-person"></i><i class="fa-solid fa-person-dress me-2"></i>Gender
            </label>
            <label class="required" for="required">*</label><br>
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

        <button type="submit" class="btn btn-primary w-100">Register as Manager</button>

        <div class="text-center mt-3">
            <a href="{{ route('login') }}">Already have an account?</a>
        </div>
    </form>

    <div class="footer mt-4">
        North & South Terminal Operations • Cebu, Philippines
    </div>
</div>

<script>
    function previewImage(event) {
            const preview = document.getElementById('photoPreview');
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                }
                reader.readAsDataURL(file);
            } else {
                preview.style.display = 'none';
                preview.src = '#';
            }
        }
</script>

@endsection