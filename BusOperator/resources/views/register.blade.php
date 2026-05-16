<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - TransiTrack</title>
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

        .register-container {
            background: var(--card-bg);
            border-radius: 15px;
            padding: 2rem;
            box-shadow: 0 10px 30px var(--shadow);
            margin-top: 20px;
            margin-bottom: 20px;
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
            color: var(--text-light);
            margin-bottom: 2rem;
        }

        .section-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--text-light);
            margin: 2rem 0 1rem 0;
            display: flex;
            align-items: center;
        }

        .section-title i {
            margin-right: 0.5rem;
            color: var(--accent);
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
        }

        .form-control::placeholder {
            color: #6c757d; 
        }

        small {
            color: #adb5bd;
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

        .terminal-select {
            background-color: var(--input-bg);
            border: 1px solid var(--input-border);
            color: var(--text-light);
            border-radius: 8px;
            padding: 0.75rem 1rem;
            width: 100%;
            cursor: pointer;
        }

        .terminal-select option {
            background-color: var(--primary-medium);
            color: var(--text-light);
        }

        .terminal-info {
            background: rgba(65, 86, 119, 0.2);
            border: 1px solid rgba(65, 86, 119, 0.3);
            border-radius: 8px;
            padding: 0.75rem;
            margin-top: 0.5rem;
            font-size: 0.85rem;
            color: #adb5bd;
        }

        /* Photo Upload Styles */
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
    </style>
</head>
<body>
    <div class="register-container">
        <div class="logo">
            <img src="{{ asset('images/transitrack_logo.png') }}" alt="TransiTrack Logo" class="logo-img">
            <h1>TransiTrack</h1>
            <p class="subtitle">Register Your Bus Operator Account</p>
        </div>

        <form method="POST" action="{{ route('register.post') }}" enctype="multipart/form-data"> <!-- Updated route name -->
            @csrf

            <!-- Photo Upload Section -->
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
            </div>

            <!-- Select Terminal Section -->
            <div class="form-group">
                <label for="terminal" class="form-label"><i class="fas fa-map-marker-alt me-2"></i>Select Terminal *</label>
                <select name="terminal"
                        id="terminal"
                        class="terminal-select"
                        required>
                    <option value="" disabled selected>Choose your operating terminal</option>
                    <option value="north">North Terminal (SM City)</option>
                    <option value="south">South Terminal</option>
                </select>
                <div class="terminal-info">
                    Your buses and routes will be filtered based on this terminal
                </div>
            </div>

            <!-- Personal Information Section -->
            <h3 class="section-title"><i class="fas fa-user"></i> Personal Information</h3>

            <div class="row g-3">
                <div class="col-md-5">
                    <div class="form-group">
                        <label for="first_name" class="form-label">First Name *</label>
                        <input type="text"
                               class="form-control"
                               id="first_name"
                               name="first_name"
                               value="{{ old('first_name') }}"
                               placeholder="Juan"
                               required>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="form-group">
                        <label for="middle_initial" class="form-label">M.I.</label>
                        <input type="text"
                               class="form-control"
                               id="middle_initial"
                               name="middle_initial"
                               value="{{ old('middle_initial') }}"
                               placeholder="D"
                               maxlength="1">
                    </div>
                </div>
                <div class="col-md-5">
                    <div class="form-group">
                        <label for="last_name" class="form-label">Last Name *</label>
                        <input type="text"
                               class="form-control"
                               id="last_name"
                               name="last_name"
                               value="{{ old('last_name') }}"
                               placeholder="Dela Cruz"
                               required>
                    </div>
                </div>
            </div>

            <div class="row g-3">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="email" class="form-label">Email Address *</label>
                        <input type="email"
                               class="form-control"
                               id="email"
                               name="email"
                               value="{{ old('email') }}"
                               placeholder="operator@example.com"
                               required>
                    </div>
                </div>
                <!-- Removed Photo URL field -->
            </div>

            <!-- Company Information Section -->
            <h3 class="section-title"><i class="fas fa-building"></i> Company Information</h3>

            <div class="row g-3">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="company_name" class="form-label">Company Name *</label>
                        <input type="text"
                               class="form-control"
                               id="company_name"
                               name="company_name"
                               value="{{ old('company_name') }}"
                               placeholder="Cebu Bus Lines Inc."
                               required>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="company_contact" class="form-label">Company Contact *</label>
                        <input type="text"
                               class="form-control"
                               id="company_contact"
                               name="company_contact"
                               value="{{ old('company_contact') }}"
                               placeholder="+63 32 234 5678"
                               required>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label for="company_address" class="form-label">Company Address *</label>
                <input type="text"
                       class="form-control"
                       id="company_address"
                       name="company_address"
                       value="{{ old('company_address') }}"
                       placeholder="123 Street, Cebu City"
                       required>
            </div>

            <div class="row g-3">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="company_email" class="form-label">Company Email *</label>
                        <input type="email"
                               class="form-control"
                               id="company_email"
                               name="company_email"
                               value="{{ old('company_email') }}"
                               placeholder="info@company.com"
                               required>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="fleet_size" class="form-label">Fleet Size *</label>
                        <input type="number"
                               class="form-control"
                               id="fleet_size"
                               name="fleet_size"
                               value="{{ old('fleet_size') }}"
                               placeholder="20"
                               min="1"
                               required>
                    </div>
                </div>
            </div>

            <!-- Security Section -->
            <h3 class="section-title"><i class="fas fa-shield-alt"></i> Security</h3>

            <div class="row g-3">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="password" class="form-label">Password *</label>
                        <input type="password"
                               class="form-control"
                               id="password"
                               name="password"
                               placeholder="Create a strong password"
                               required>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="password_confirmation" class="form-label">Confirm Password *</label>
                        <input type="password"
                               class="form-control"
                               id="password_confirmation"
                               name="password_confirmation"
                               placeholder="Confirm your password"
                               required>
                    </div>
                </div>
            </div>

            <!-- Submit Button -->
            <button type="submit" class="btn btn-primary mt-3">Register as Operator</button>

            <div class="links mt-3">
                Already have an account? <a href="{{ route('login') }}">Sign in here</a>
            </div>
        </form>

        <div class="footer mt-4">
            North & South Terminal Operations • Cebu, Philippines
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
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
</body>
</html>