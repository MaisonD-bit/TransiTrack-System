@extends('layouts.app')

@section('title', 'Driver Profile')

@section('content')
<div class="container-fluid">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="fw-bold mb-0"><i class="fas fa-id-card text-primary me-2"></i>Driver Profile</h2>
        <div class="d-flex gap-2">
            <a href="{{ route('drivers.panel') }}" class="btn btn-outline-secondary">
                <i class="fas fa-arrow-left me-1"></i> Back to Drivers
            </a>
            <button class="btn btn-outline-primary" onclick="editDriver({{ $driver->id }})">
                <i class="fas fa-edit me-1"></i> Edit Driver
            </button>
            <button class="btn btn-outline-danger" onclick="deleteDriver({{ $driver->id }})">
                <i class="fas fa-trash-alt me-1"></i> Delete
            </button>
            <button class="btn btn-outline-{{ $driver->status === 'active' ? 'warning' : 'success' }}" onclick="toggleDriverStatus({{ $driver->id }}, '{{ $driver->status }}')">
                <i class="fas fa-power-off me-1"></i> {{ $driver->status === 'active' ? 'Deactivate' : 'Activate' }}
            </button>
        </div>
    </div>

    <!-- Driver Profile Card -->
    <div class="card border-0 bg-white shadow-sm mb-4">
        <div class="card-body p-2">
            <div class="row align-items-start g-3">
                <!-- Photo & Status -->
                <div class="col-md-2 d-flex flex-column align-items-center">
                    <img src="{{ $driver->photo_url ? asset('storage/'.$driver->photo_url) : 'https://randomuser.me/api/portraits/men/'.(($driver->id ?? 1) % 70).'.jpg' }}" 
                         alt="Driver Photo" 
                         class="rounded-circle border border-3 border-light shadow" 
                         style="width: 200px; height: 200px; min-width: 200px; min-height: 200px; object-fit: cover; display: block; aspect-ratio: 1;">
                    <div class="mt-2 d-flex justify-content-center" style="width: 100%;">
                        @if($driver->status == 'active')
                            <span class="badge bg-success fs-5">
                                <i class="fas fa-circle me-1" style="font-size: 8px;"></i>Active
                            </span>
                        @elseif($driver->status == 'inactive')
                            <span class="badge bg-danger fs-5">
                                <i class="fas fa-circle me-1" style="font-size: 8px;"></i>Inactive
                            </span>
                        @else
                            <span class="badge bg-warning fs-5">
                                <i class="fas fa-circle me-1" style="font-size: 8px;"></i>On Leave
                            </span>
                        @endif
                    </div>
                </div>

                <!-- Name & ID -->
                <div class="col-md-3 d-flex flex-column justify-content-center">
                    <h2 class="fw-bold text-dark mb-1" style="font-size: 1.6rem;">{{ $driver->name ?? 'Unnamed Driver' }}</h2>
                    <p class="text-muted mb-0" style="font-size: 1.1rem;">Driver ID: <strong>DRV-{{ str_pad($driver->id ?? 1, 3, '0', STR_PAD_LEFT) }}</strong></p>
                </div>
                
                <!-- Driver Info -->
                <div class="col-md-7">
                    <div class="row g-2">
                        <div class="col-md-6">
                            <div class="d-flex align-items-start">
                                <div class="bg-primary bg-opacity-10 rounded-circle me-2 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 40px; height: 40px;">
                                    <i class="fas fa-birthday-cake text-primary" style="font-size: 1rem;"></i>
                                </div>
                                <div style="min-width: 0;">
                                    <small class="text-muted d-block" style="font-size: 0.9rem; font-weight: 500;">Date of Birth</small>
                                    <span class="fw-semibold" style="font-size: 1.05rem; display: block; word-break: break-word;">{{ $driver->date_of_birth ? $driver->date_of_birth->format('F j, Y') : 'Not provided' }}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="d-flex align-items-start">
                                <div class="bg-primary bg-opacity-10 rounded-circle me-2 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 40px; height: 40px;">
                                    <i class="fas fa-venus-mars text-primary" style="font-size: 1rem;"></i>
                                </div>
                                <div style="min-width: 0;">
                                    <small class="text-muted d-block" style="font-size: 0.9rem; font-weight: 500;">Gender</small>
                                    <span class="fw-semibold" style="font-size: 1.05rem; display: block;">{{ ucfirst($driver->gender ?? 'Not specified') }}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="d-flex align-items-start">
                                <div class="bg-primary bg-opacity-10 rounded-circle me-2 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 40px; height: 40px;">
                                    <i class="fas fa-phone-alt text-primary" style="font-size: 1rem;"></i>
                                </div>
                                <div style="min-width: 0;">
                                    <small class="text-muted d-block" style="font-size: 0.9rem; font-weight: 500;">Contact Number</small>
                                    <span class="fw-semibold" style="font-size: 1.05rem; display: block;">{{ $driver->contact_number ?? 'Not provided' }}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="d-flex align-items-start">
                                <div class="bg-primary bg-opacity-10 rounded-circle me-2 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 40px; height: 40px;">
                                    <i class="fas fa-envelope text-primary" style="font-size: 1rem;"></i>
                                </div>
                                <div style="min-width: 0;">
                                    <small class="text-muted d-block" style="font-size: 0.9rem; font-weight: 500;">Email Address</small>
                                    <span class="fw-semibold" style="font-size: 1.05rem; display: block; word-break: break-all;">{{ $driver->email ?? 'Not provided' }}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-12">
                            <div class="d-flex align-items-start">
                                <div class="bg-primary bg-opacity-10 rounded-circle me-2 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 40px; height: 40px;">
                                    <i class="fas fa-map-marker-alt text-primary" style="font-size: 1rem;"></i>
                                </div>
                                <div style="min-width: 0;">
                                    <small class="text-muted d-block" style="font-size: 0.9rem; font-weight: 500;">Address</small>
                                    <span class="fw-semibold" style="font-size: 1.05rem; display: block; word-break: break-word;">{{ $driver->address ?? 'Not provided' }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Information Cards -->
    <div class="row mb-4 g-3">
        <!-- License Information -->
        <div class="col-md-6">
            <div class="card border-0 bg-white shadow-sm h-100">
                <div class="card-header bg-light py-2">
                    <h5 class="card-title mb-0" style="font-size: 1rem;"><i class="fas fa-id-card text-primary me-2"></i>License Information</h5>
                </div>
                <div class="card-body py-2">
                    <div class="row g-2">
                        <div class="col-12">
                            <small class="text-muted d-block" style="font-size: 0.9rem; font-weight: 500;">License Number</small>
                            <span class="fw-semibold" style="font-size: 1.05rem;">{{ $driver->license_number ?? 'Not provided' }}</span>
                        </div>
                        <div class="col-12">
                            <small class="text-muted d-block" style="font-size: 0.9rem; font-weight: 500;">Expiry Date</small>
                            <span class="fw-semibold" style="font-size: 1.05rem;">{{ $driver->license_expiry ? $driver->license_expiry->format('F j, Y') : 'Not provided' }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Emergency Contact -->
        <div class="col-md-6">
            <div class="card border-0 bg-white shadow-sm h-100">
                <div class="card-header bg-light py-2">
                    <h5 class="card-title mb-0" style="font-size: 1rem;"><i class="fas fa-exclamation-circle text-warning me-2"></i>Emergency Contact</h5>
                </div>
                <div class="card-body py-2">
                    <div class="row g-2">
                        <div class="col-12">
                            <small class="text-muted d-block" style="font-size: 0.9rem; font-weight: 500;">Contact Person</small>
                            <span class="fw-semibold" style="font-size: 1.05rem;">{{ $driver->emergency_name ?? 'Not provided' }}</span>
                        </div>
                        <div class="col-6">
                            <small class="text-muted d-block" style="font-size: 0.9rem; font-weight: 500;">Relationship</small>
                            <span class="fw-semibold" style="font-size: 1.05rem;">{{ $driver->emergency_relation ?? 'Not provided' }}</span>
                        </div>
                        <div class="col-6">
                            <small class="text-muted d-block" style="font-size: 0.9rem; font-weight: 500;">Contact Number</small>
                            <span class="fw-semibold" style="font-size: 1.05rem;">{{ $driver->emergency_contact ?? 'Not provided' }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Assigned Routes & Schedules -->
    <div class="card border-0 bg-white shadow-sm">
        <div class="card-header border-bottom">
            <h5 class="card-title mb-0"><i class="fas fa-route text-success me-2"></i>Assigned Routes & Schedules</h5>
        </div>
        <div class="card-body">
            <!-- Date Filter -->
            <div id="schedules-filter" class="row g-2 mb-4 pb-3 border-bottom">
                <div class="col-md-3">
                    <label for="from_date" class="form-label">From Date</label>
                    <input type="date" id="from_date" name="from_date" class="form-control" 
                           value="{{ request('from_date') }}" onchange="applyDateFilter()">
                </div>
                <div class="col-md-3">
                    <label for="to_date" class="form-label">To Date</label>
                    <input type="date" id="to_date" name="to_date" class="form-control" 
                           value="{{ request('to_date') }}" onchange="applyDateFilter()">
                </div>
                <div class="col-md-2">
                    <label for="route_id" class="form-label">Route</label>
                    <select id="route_id" name="route_id" class="form-select" onchange="applyDateFilter()">
                        <option value="">-- All Routes --</option>
                        @foreach($routes as $id => $name)
                            <option value="{{ $id }}" {{ request('route_id') == $id ? 'selected' : '' }}>{{ $name }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-2">
                    <label for="bus_id" class="form-label">Bus</label>
                    <select id="bus_id" name="bus_id" class="form-select" onchange="applyDateFilter()">
                        <option value="">-- All Buses --</option>
                        @foreach($buses as $id => $number)
                            <option value="{{ $id }}" {{ request('bus_id') == $id ? 'selected' : '' }}>{{ $number }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-2 d-flex align-items-end">
                    <button class="btn btn-outline-secondary w-100" onclick="clearDateFilter()">
                        <i class="fas fa-times me-1"></i> Clear Filter
                    </button>
                </div>
            </div>

            @if(isset($schedules) && $schedules->count() > 0)
                <div class="row g-3">
                    @foreach($schedules as $schedule)
                        @if($schedule->route && $schedule->bus)
                            <div class="col-lg-6">
                                <div class="border rounded p-2 bg-light">
                                    <!-- Bus Info -->
                                    <div class="d-flex align-items-center mb-1">
                                        <i class="fas fa-bus text-primary me-2" style="font-size: 1.1rem;"></i>
                                        <div>
                                            <div class="fw-semibold" style="font-size: 1rem;">{{ $schedule->bus->bus_number }}</div>
                                            <small class="text-muted" style="font-size: 0.9rem;">{{ $schedule->bus->model }}</small>
                                            @if($schedule->bus->accommodation_type)
                                                <br><span class="badge bg-info" style="font-size: 11px;">{{ ucfirst(str_replace('-', ' ', $schedule->bus->accommodation_type)) }}</span>
                                            @endif
                                        </div>
                                    </div>

                                    <!-- Route Info -->
                                    <div class="mb-1 pb-1 border-bottom">
                                        <div class="fw-bold text-dark" style="font-size: 1rem;">{{ $schedule->route->name }}</div>
                                        <small class="text-muted d-block" style="font-size: 0.9rem;">
                                            {{ $schedule->route->start_location ?? 'Start' }} 
                                            <i class="fas fa-arrow-right mx-1"></i>
                                            {{ $schedule->route->end_location ?? 'End' }}
                                        </small>
                                    </div>

                                    <!-- Schedule Details -->
                                    <div class="row g-1 mb-1">
                                        <div class="col-6">
                                            <small class="text-muted d-block" style="font-size: 0.85rem;">Date</small>
                                            <small class="fw-semibold" style="font-size: 0.95rem;">{{ $schedule->date ? \Carbon\Carbon::parse($schedule->date)->format('m/d/Y') : '--' }}</small>
                                            @if($schedule->date)
                                                <br><small class="text-muted" style="font-size: 0.85rem;">{{ \Carbon\Carbon::parse($schedule->date)->format('l') }}</small>
                                            @endif
                                        </div>
                                        <div class="col-6">
                                            <small class="text-muted d-block" style="font-size: 0.85rem;">Time</small>
                                            <small class="fw-semibold" style="font-size: 0.95rem;">{{ $schedule->start_time ? \Carbon\Carbon::parse($schedule->start_time)->format('h:i A') : '--' }}</small>
                                            <br>
                                            <small class="text-muted" style="font-size: 0.85rem;">to {{ $schedule->end_time ? \Carbon\Carbon::parse($schedule->end_time)->format('h:i A') : '--' }}</small>
                                        </div>
                                    </div>

                                    <!-- Status -->
                                    @if($schedule->status)
                                        <div class="d-flex justify-content-between align-items-center">
                                            <small class="text-muted" style="font-size: 0.85rem;">Status</small>
                                            @if($schedule->status == 'active')
                                                <span class="badge bg-success" style="font-size: 0.85rem;">Active</span>
                                            @elseif($schedule->status == 'completed')
                                                <span class="badge bg-secondary" style="font-size: 0.85rem;">Completed</span>
                                            @elseif($schedule->status == 'cancelled')
                                                <span class="badge bg-danger" style="font-size: 0.85rem;">Cancelled</span>
                                            @else
                                                <span class="badge bg-warning text-dark" style="font-size: 0.85rem;">{{ ucfirst($schedule->status) }}</span>
                                            @endif
                                        </div>
                                    @endif
                                </div>
                            </div>
                        @endif
                    @endforeach
                </div>

                <!-- Pagination -->
                <nav class="mt-4" aria-label="Pagination Navigation">
                    <ul class="pagination justify-content-center mb-0">
                        {{-- Previous Page Link --}}
                        @if ($schedules->onFirstPage())
                            <li class="page-item disabled"><span class="page-link">&laquo; Previous</span></li>
                        @else
                            <li class="page-item"><a class="page-link" href="{{ $schedules->previousPageUrl() }}&from_date={{ request('from_date') }}&to_date={{ request('to_date') }}&route_id={{ request('route_id') }}&bus_id={{ request('bus_id') }}">&laquo; Previous</a></li>
                        @endif

                        {{-- Pagination Elements --}}
                        @foreach ($schedules->getUrlRange(1, $schedules->lastPage()) as $page => $url)
                            @if ($page == $schedules->currentPage())
                                <li class="page-item active"><span class="page-link">{{ $page }}</span></li>
                            @else
                                <li class="page-item"><a class="page-link" href="{{ $url }}&from_date={{ request('from_date') }}&to_date={{ request('to_date') }}&route_id={{ request('route_id') }}&bus_id={{ request('bus_id') }}">{{ $page }}</a></li>
                            @endif
                        @endforeach

                        {{-- Next Page Link --}}
                        @if ($schedules->hasMorePages())
                            <li class="page-item"><a class="page-link" href="{{ $schedules->nextPageUrl() }}&from_date={{ request('from_date') }}&to_date={{ request('to_date') }}&route_id={{ request('route_id') }}&bus_id={{ request('bus_id') }}">Next &raquo;</a></li>
                        @else
                            <li class="page-item disabled"><span class="page-link">Next &raquo;</span></li>
                        @endif
                    </ul>
                </nav>
            
            @else
                <div class="text-center py-5">
                    <i class="fas fa-route fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No Routes Assigned</h5>
                    <p class="text-muted">This driver has not been assigned to any routes or schedules yet.</p>
                    <a href="{{ route('schedule.panel') }}" class="btn btn-outline-primary btn-sm">
                        <i class="fas fa-plus me-1"></i> Assign Schedule
                    </a>
                </div>
            @endif
        </div>
    </div>

    <!-- Additional Notes (if any) -->
    @if($driver->notes)
    <div class="card border-0 bg-white shadow-sm mt-4">
        <div class="card-header bg-light">
            <h5 class="card-title mb-0"><i class="fas fa-sticky-note text-info me-2"></i>Additional Notes</h5>
        </div>
        <div class="card-body">
            <p class="mb-0">{{ $driver->notes }}</p>
        </div>
    </div>
    @endif

    <!-- Confirmation Modal for Delete -->
    <div class="modal fade" id="confirmDeleteModal" tabindex="-1" aria-labelledby="confirmDeleteModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-danger">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title" id="confirmDeleteModalLabel">
                        <i class="fas fa-exclamation-triangle me-2"></i>Delete Driver
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p class="mb-0">Are you sure you want to delete this driver? <strong>This action cannot be undone.</strong></p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-1"></i> Cancel
                    </button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteBtn">
                        <i class="fas fa-trash-alt me-1"></i> Delete Driver
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Confirmation Modal for Toggle Status -->
    <div class="modal fade" id="confirmToggleStatusModal" tabindex="-1" aria-labelledby="confirmToggleStatusModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header bg-warning">
                    <h5 class="modal-title" id="confirmToggleStatusModalLabel">
                        <i class="fas fa-info-circle me-2"></i><span id="toggleStatusTitle">Deactivate Driver</span>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p class="mb-0">Are you sure you want to <strong id="toggleStatusAction">deactivate</strong> this driver?</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-1"></i> Cancel
                    </button>
                    <button type="button" class="btn btn-warning" id="confirmToggleStatusBtn">
                        <i class="fas fa-check me-1"></i> <span id="toggleStatusBtnText">Deactivate</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Edit Driver Modal -->
    <div class="modal fade" id="editDriverModal" tabindex="-1" aria-labelledby="editDriverModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title" id="editDriverModalLabel">
                        <i class="fas fa-edit me-2"></i>Edit Driver Information
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form id="editDriverForm" enctype="multipart/form-data">
                        @csrf
                        <input type="hidden" id="edit_driver_id" name="driver_id" value="{{ $driver->id }}">
                        
                        <div class="row">
                            <!-- Photo Upload -->
                            <div class="col-md-4 text-center mb-4">
                                <label class="form-label fw-bold">Driver Photo</label>
                                <div class="mx-auto" style="cursor: pointer; width: 150px; height: 150px;">
                                    <img id="edit-photo-preview" 
                                         src="{{ $driver->photo_url ? asset('storage/'.$driver->photo_url) : 'https://randomuser.me/api/portraits/men/'.(($driver->id ?? 1) % 70).'.jpg' }}" 
                                         alt="Driver Photo" 
                                         class="rounded-circle border border-3 border-light shadow w-100 h-100" 
                                         style="object-fit: cover;">
                                    <input type="file" id="edit_photo" name="photo" accept="image/*" style="display: none;">
                                </div>
                                <small class="text-muted d-block mt-2">Click to upload photo</small>
                            </div>
                            
                            <!-- Form Fields -->
                            <div class="col-md-8">
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label for="edit_name" class="form-label">Full Name <span class="text-danger">*</span></label>
                                        <input type="text" id="edit_name" name="name" class="form-control" value="{{ $driver->name }}" required>
                                        <div class="invalid-feedback" id="edit_name_error"></div>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label for="edit_email" class="form-label">Email Address <span class="text-danger">*</span></label>
                                        <input type="email" id="edit_email" name="email" class="form-control" value="{{ $driver->email }}" required>
                                        <div class="invalid-feedback" id="edit_email_error"></div>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label for="edit_contact_number" class="form-label">Contact Number <span class="text-danger">*</span></label>
                                        <input type="tel" id="edit_contact_number" name="contact_number" class="form-control" value="{{ $driver->contact_number }}" required>
                                        <div class="invalid-feedback" id="edit_contact_number_error"></div>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label for="edit_date_of_birth" class="form-label">Date of Birth <span class="text-danger">*</span></label>
                                        <input type="date" id="edit_date_of_birth" name="date_of_birth" class="form-control" value="{{ $driver->date_of_birth ? $driver->date_of_birth->format('Y-m-d') : '' }}" required>
                                        <div class="invalid-feedback" id="edit_date_of_birth_error"></div>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label for="edit_gender" class="form-label">Gender <span class="text-danger">*</span></label>
                                        <select id="edit_gender" name="gender" class="form-select" required>
                                            <option value="male" {{ $driver->gender === 'male' ? 'selected' : '' }}>Male</option>
                                            <option value="female" {{ $driver->gender === 'female' ? 'selected' : '' }}>Female</option>
                                            <option value="other" {{ $driver->gender === 'other' ? 'selected' : '' }}>Other</option>
                                        </select>
                                        <div class="invalid-feedback" id="edit_gender_error"></div>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label for="edit_status" class="form-label">Status <span class="text-danger">*</span></label>
                                        <select id="edit_status" name="status" class="form-select" required>
                                            <option value="active" {{ $driver->status === 'active' ? 'selected' : '' }}>Active</option>
                                            <option value="inactive" {{ $driver->status === 'inactive' ? 'selected' : '' }}>Inactive</option>
                                            <option value="on-leave" {{ $driver->status === 'on-leave' ? 'selected' : '' }}>On Leave</option>
                                        </select>
                                        <div class="invalid-feedback" id="edit_status_error"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label for="edit_address" class="form-label">Address <span class="text-danger">*</span></label>
                            <textarea id="edit_address" name="address" class="form-control" rows="2" required>{{ $driver->address }}</textarea>
                            <div class="invalid-feedback" id="edit_address_error"></div>
                        </div>
                        
                        <!-- License Information -->
                        <div class="border border-primary border-opacity-25 rounded p-3 mb-3">
                            <h6 class="text-primary mb-3"><i class="fas fa-id-card me-2"></i>License Information</h6>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="edit_license_number" class="form-label">License Number <span class="text-danger">*</span></label>
                                    <input type="text" id="edit_license_number" name="license_number" class="form-control" value="{{ $driver->license_number }}" required>
                                    <div class="invalid-feedback" id="edit_license_number_error"></div>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="edit_license_expiry" class="form-label">License Expiry <span class="text-danger">*</span></label>
                                    <input type="date" id="edit_license_expiry" name="license_expiry" class="form-control" value="{{ $driver->license_expiry ? $driver->license_expiry->format('Y-m-d') : '' }}" required>
                                    <div class="invalid-feedback" id="edit_license_expiry_error"></div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Emergency Contact -->
                        <div class="border border-warning border-opacity-25 rounded p-3 mb-3">
                            <h6 class="text-warning mb-3"><i class="fas fa-exclamation-circle me-2"></i>Emergency Contact</h6>
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <label for="edit_emergency_name" class="form-label">Contact Person <span class="text-danger">*</span></label>
                                    <input type="text" id="edit_emergency_name" name="emergency_name" class="form-control" value="{{ $driver->emergency_name }}" required>
                                    <div class="invalid-feedback" id="edit_emergency_name_error"></div>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label for="edit_emergency_relation" class="form-label">Relationship <span class="text-danger">*</span></label>
                                    <input type="text" id="edit_emergency_relation" name="emergency_relation" class="form-control" value="{{ $driver->emergency_relation }}" required>
                                    <div class="invalid-feedback" id="edit_emergency_relation_error"></div>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label for="edit_emergency_contact" class="form-label">Emergency Contact <span class="text-danger">*</span></label>
                                    <input type="tel" id="edit_emergency_contact" name="emergency_contact" class="form-control" value="{{ $driver->emergency_contact }}" required>
                                    <div class="invalid-feedback" id="edit_emergency_contact_error"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label for="edit_notes" class="form-label">Additional Notes</label>
                            <textarea id="edit_notes" name="notes" class="form-control" rows="2">{{ $driver->notes }}</textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-1"></i> Cancel
                    </button>
                    <button type="button" class="btn btn-primary" id="saveDriverBtn">
                        <i class="fas fa-save me-1"></i> <span id="saveDriverText">Save Changes</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection

@push('scripts')
@vite('resources/js/panels/profile.js')
@endpush