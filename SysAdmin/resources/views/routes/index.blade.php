@extends('layouts.app')

@section('title', 'Routes')

@push('styles')
<link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet">
<style>
    .route-map-host {
        position: relative;
        width: 100%;
        height: 400px;
        overflow: hidden;
        contain: strict;
        background: #e5e7eb;
    }
    #viewRouteMap,
    #routeMap {
        position: absolute;
        inset: 0;
    }
    .route-map-host .mapboxgl-canvas,
    .route-map-host .mapboxgl-canvas-container,
    .route-map-host .mapboxgl-control-container {
        max-width: 100%;
        max-height: 100%;
    }
</style>
@endpush

@section('content')
<div class="container-fluid">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="fw-bold mb-0"><i class="fas fa-route text-primary me-2"></i>Route Management</h2>
        <button class="btn btn-sm btn-outline-primary ms-2 active" onclick="showAddRouteForm()">
            <i class="fas fa-plus me-1"></i> Add Route
        </button>
    </div>

    <!-- Search and Filter Section -->
    <div class="card border-0 bg-white shadow-sm mb-4">
    <div class="card-body">
        <form method="GET" action="{{ route('sysadmin.routes') }}" class="row g-3">
        <div class="col-md-2">
            <label for="filter_terminal" class="form-label">Terminal</label>
            <select id="filter_terminal" name="terminal" class="form-select">
                <option value="">All</option>
                <option value="north" {{ request('terminal') === 'north' ? 'selected' : '' }}>North</option>
                <option value="south" {{ request('terminal') === 'south' ? 'selected' : '' }}>South</option>
            </select>
        </div>
        <div class="col-md-3">
            <label for="search" class="form-label">Search Routes</label>
            <input type="text" id="search" name="search" class="form-control"
                placeholder="Name, code, or location..."
                value="{{ request('search') }}">
        </div>

        <!-- Status Filter -->
        <div class="col-md-2">
            <label for="filter_status" class="form-label">Status</label>
            <select id="filter_status" name="status" class="form-select">
            <option value="">All</option>
            <option value="active" {{ request('status') === 'active' ? 'selected' : '' }}>Active</option>
            <option value="inactive" {{ request('status') === 'inactive' ? 'selected' : '' }}>Inactive</option>
            </select>
        </div>

        <!-- Bus Type Filter -->
        <div class="col-md-2">
            <label for="filter_bus_type" class="form-label">Bus Type</label>
            <select id="filter_bus_type" name="bus_type" class="form-select">
            <option value="">All Types</option>
            <option value="regular" {{ request('bus_type') === 'regular' ? 'selected' : '' }}>Regular</option>
            <option value="aircon" {{ request('bus_type') === 'aircon' ? 'selected' : '' }}>Air-Con</option>
            </select>
        </div>

        <!-- Action Buttons -->
        <div class="col-md-3 d-flex align-items-end gap-2">
            <button type="submit" class="btn btn-outline-primary">
            <i class="fas fa-search me-1"></i> Apply Filters
            </button>
            <a href="{{ route('sysadmin.routes') }}" class="btn btn-outline-secondary">
            <i class="fas fa-times me-1"></i> Clear
            </a>
        </div>
        </form>
    </div>
    </div>

    <!-- View -->
    <div id="viewRouteFormSection" class="card border-0 bg-white shadow-sm mb-4" style="display: none;">
        <div class="card-header bg-primary text-white">
            <div class="d-flex justify-content-between align-items-center">
                <h5 class="mb-0" id="view_formTitle">
                    <i class="fas fa-eye me-2"></i>View Route
                </h5>
                <button type="button" class="btn-close btn-close-white" onclick="hideViewRouteForm()"></button>
            </div>
        </div>
        <div class="card-body">
            <form id="viewRouteForm" method="POST">
                @csrf
                <input type="hidden" id="view_route_id" name="route_id">
                <input type="hidden" id="view_method_field" value="" view-only>
                <input type="hidden" id="view_distance_km" name="distance_km" view-only>
                <input type="hidden" id="view_estimated_duration" name="estimated_duration" view-only>
                <input type="hidden" id="view_start_coordinates" name="start_coordinates" value="123.920994,10.311008" view-only>
                <input type="hidden" id="view_end_coordinates" name="end_coordinates" view-only>
                <input type="hidden" id="view_stops_data" name="stops_data" view-only>
                <input type="hidden" id="view_geometry" name="geometry" view-only>

                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="view_route_code" class="form-label">Route Code <span class="text-danger">*</span></label>
                        <input type="text" id="view_route_code" name="code" class="form-control" readonly>
                        <div class="invalid-feedback" id="code_error"></div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label for="view_route_name" class="form-label">Route Name <span class="text-danger">*</span></label>
                        <input type="text" id="view_route_name" name="name" class="form-control" readonly>
                        <div class="invalid-feedback" id="name_error"></div>
                    </div>
                </div>

                <!-- Start Location (Fixed) -->
                <div class="row mb-3">
                    <div class="col-12">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            All routes start from: <strong id="view_terminal_label">North Bus Terminal</strong>
                            <br>
                            This is the main departure point for this route.
                        </div>
                    </div>
                </div>

                <!-- Destination Search -->
                <!-- <div class="mb-3">
                <label for="destinationSearch" class="form-label">Search Destination in Cebu</label>
                <input type="text" id="destinationSearch" class="form-control" placeholder="Type a destination (e.g., Tabogon, Daanbantayan)">
                <div id="geocodingResults" class="list-group mt-1" style="max-height: 200px; overflow-y: auto; display: none;"></div>
                </div> -->

                <!-- Map for End Location and Stops Selection -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card">
                            <!-- <div class="card-header bg-light">
                                <h6 class="mb-0"><i class="fas fa-map-marker-alt me-2"></i>Select Destination & Stops in Cebu</h6>
                                <small class="text-muted">Click on the map to set the destination (red marker). Add a pathway by clicking "Add Pathway" and then clicking on the map for each stop.</small>
                            </div> -->
                            <div class="card-body p-0">
                                <div class="route-map-host" style="position: relative; width: 100%; height: 400px; overflow: hidden;">
                                    <div id="viewRouteMap" style="position: absolute; inset: 0;"></div>
                                </div>
                            </div>
                            <div class="card-footer bg-light">
                                <div class="row">
                                    <!-- <div class="col-md-4">
                                        <small class="text-success">
                                            <i class="fas fa-circle text-success me-1"></i>
                                            Start: Cebu North Bus Terminal (Fixed)
                                        </small>
                                    </div> -->
                                    <!-- <div class="col-md-4">
                                        <small class="text-danger">
                                            <i class="fas fa-circle text-danger me-1"></i>
                                            Click to Set Destination
                                        </small>
                                    </div>
                                    <div class="col-md-4">
                                        <small class="text-primary">
                                        <i class="fas fa-route text-primary me-1"></i>
                                        Add Pathway (Optional)
                                        </small>
                                    </div> -->
                                </div>
                                <!-- <div class="mt-2 d-flex gap-2">
                                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="clearEndPoint()">
                                        <i class="fas fa-trash me-1"></i>Clear Destination
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="centerMapToCebu()">
                                        <i class="fas fa-crosshairs me-1"></i>Center to Cebu
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-success" id="addStopBtn">
                                    <i class="fas fa-route me-1"></i>Add Pathway
                                    </button>
                                </div> -->
                                {{-- view_stopsList intentionally removed — SysAdmin only reviews the route pathway here --}}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="view_start_location" class="form-label">Start Location</label>
                        <input type="text" id="view_start_location" name="start_location" class="form-control" readonly value="Cebu North Bus Terminal (SM City)" style="background-color: #e9ecef;">
                        <small class="text-muted">Fixed starting point for all routes</small>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label for="view_end_location" class="form-label">Destination <span class="text-danger">*</span></label>
                        <input type="text" id="view_end_location" name="end_location" class="form-control" required readonly placeholder="Click on map to select destination">
                        <small class="text-muted">Auto-filled from map selection</small>
                        <div class="invalid-feedback" id="end_location_error"></div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-3 mb-3">
                    <label for="view_route_fare" class="form-label">Route Fare <span class="text-danger">*</span></label>
                    <div class="input-group">
                        <span class="input-group-text">&#8369;</span>
                        <input type="number" step="0.01" id="view_route_fare" name="route_fare" class="form-control" required readonly>
                    </div>
                    <small class="text-muted">Auto-calculated based on distance and bus type</small>
                    </div>
                    <div class="col-md-3 mb-3">
                        <label for="view_route_status" class="form-label">Status <span class="text-danger">*</span></label>
                        <!-- <select id="view_route_status" name="status" class="form-select" required>
                            <option value="inactive">Inactive</option>
                            <option value="active">Active</option>
                        </select> -->
                        <input id="view_route_status" name="status" class="form-control" required readonly>
                        <div class="invalid-feedback" id="status_error"></div>
                    </div>
                    <div class="col-md-3 mb-3">
                        <label for="view_bus_type" class="form-label">Bus Type <span class="text-danger">*</span></label>
                        <!-- <select id="view_bus_type" name="bus_type" class="form-select" required>
                            <option value="regular">Regular (Non Air-Con)</option>
                            <option value="aircon">Air-Conditioned</option>
                        </select> -->

                        <input id="view_bus_type" name="bus_type" class="form-control" required readonly>
                        <div class="invalid-feedback" id="bus_type_error"></div>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label">Return Trip Route</label>
                    <div id="view_returnTripInfo" class="alert alert-info mb-0 py-2 d-flex align-items-center gap-2">
                        <i class="fas fa-exchange-alt"></i>
                        <span id="view_returnTripInfoText">A return trip route will be automatically created when you save.</span>
                    </div>
                </div>

                <div class="mb-3">
                    <label for="view_description" class="form-label">Description</label>
                    <textarea id="view_description" name="description" class="form-control" rows="3" readonly></textarea>
                    <div class="invalid-feedback" id="description_error"></div>
                </div>

                <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-secondary" onclick="hideViewRouteForm()">
                        <i class="fas fa-times me-2"></i>Cancel
                    </button>
                    <!-- <button type="submit" class="btn btn-primary" id="saveRouteBtn">
                        <i class="fas fa-save me-2"></i>Save Route
                    </button> -->
                </div>
            </form>
        </div>
    </div>

    <!-- Add -->
    <div id="routeFormSection" class="card border-0 bg-white shadow-sm mb-4" style="display: none;">
        <div class="card-header bg-primary text-white">
            <div class="d-flex justify-content-between align-items-center">
                <h5 class="mb-0" id="add_formTitle">
                    <i class="fas fa-route me-2"></i>Add New Route
                </h5>
                <button type="button" class="btn-close btn-close-white" onclick="hideRouteForm()"></button>
            </div>
        </div>
        <div class="card-body">
            <form id="routeForm" method="POST">
                @csrf
                <input type="hidden" id="route_id" name="route_id">
                <input type="hidden" id="method_field" value="">
                <input type="hidden" id="distance_km" name="distance_km">
                <input type="hidden" id="estimated_duration" name="estimated_duration">
                <input type="hidden" id="start_coordinates" name="start_coordinates" value="123.920994,10.311008">
                <input type="hidden" id="end_coordinates" name="end_coordinates">
                <input type="hidden" id="stops_data" name="stops_data">
                <input type="hidden" id="geometry" name="geometry">
                <input type="hidden" id="route_terminal" name="terminal" value="north">

                <div class="row g-3 mb-4">
                    <div class="col-md-3">
                        <label for="route_terminal_select" class="form-label mb-1">Terminal <span class="text-danger">*</span></label>
                        <select id="route_terminal_select" class="form-select" required title="Highlighted map area changes based on this selection">
                            <option value="north" selected>North Terminal - SM CITY</option>
                            <option value="south">South Terminal</option>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <label for="route_code" class="form-label mb-1">Route Code <span class="text-danger">*</span></label>
                        <input type="text" id="route_code" name="code" class="form-control">
                        <div class="invalid-feedback" id="code_error"></div>
                    </div>
                    <div class="col-md-5">
                        <label for="route_name" class="form-label mb-1">Route Name <span class="text-danger">*</span></label>
                        <input type="text" id="route_name" name="name" class="form-control">
                        <div class="invalid-feedback" id="name_error"></div>
                    </div>
                </div>

                <!-- Start Location (Fixed) -->
                <div class="row mb-3">
                    <div class="col-12">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            All routes start from the selected terminal: <strong id="add_terminal_label">North Bus Terminal</strong>
                            <br>
                            This is the main departure point for your routes.
                        </div>
                    </div>
                </div>

                {{-- Destination Search (optional) --}}
                <div class="mb-3">
                    <label for="destinationSearch" class="form-label">Search Destination in Cebu</label>
                    <input type="text" id="destinationSearch" class="form-control" placeholder="Type a destination (e.g., Tabogon, Daanbantayan)">
                    <div id="geocodingResults" class="list-group mt-1" style="max-height: 200px; overflow-y: auto; display: none;"></div>
                </div>

                <!-- Map for End Location and Stops Selection -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header bg-light">
                                <h6 class="mb-0"><i class="fas fa-map-marker-alt me-2"></i>Select Destination in Cebu</h6>
                                <small class="text-muted">Click on the map (inside the highlighted area) to set the destination, then use <strong>Add Pathway</strong> to drop stops along the route.</small>
                            </div>
                            <div class="card-body p-0">
                                <div class="route-map-host" style="position: relative; width: 100%; height: 400px; overflow: hidden;">
                                    <div id="routeMap" style="position: absolute; inset: 0;"></div>
                                </div>
                            </div>
                            <div class="card-footer bg-light">
                                <div class="row">
                                    <div class="col-md-6">
                                        <small class="text-success">
                                            <i class="fas fa-circle text-success me-1"></i>
                                            Start: <span id="add_terminal_label_inline">North Bus Terminal</span> (fixed)
                                        </small>
                                    </div>
                                    <div class="col-md-6 text-md-end">
                                        <small class="text-danger">
                                            <i class="fas fa-circle text-danger me-1"></i>
                                            Click inside the highlighted area to set destination
                                        </small>
                                    </div>
                                </div>
                                <div class="mt-2 d-flex gap-2 flex-wrap">
                                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="clearEndPoint()">
                                        <i class="fas fa-trash me-1"></i>Clear Destination
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="centerMapToCebu()">
                                        <i class="fas fa-crosshairs me-1"></i>Center to Cebu
                                    </button>
                                    {{-- Pathway controls: only shown when editing an existing route --}}
                                    <div id="pathwayControls" class="d-flex gap-2" style="display: none !important;">
                                        <button type="button" class="btn btn-sm btn-outline-success" id="addStopBtn">
                                            <i class="fas fa-map-pin me-1"></i>Add Pathway
                                        </button>
                                        <button type="button" class="btn btn-sm btn-outline-warning" onclick="clearStops()">
                                            <i class="fas fa-eraser me-1"></i>Clear Pathway
                                        </button>
                                    </div>
                                </div>
                                <div id="stopsList" class="mt-3" style="display: none;"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label for="start_location" class="form-label">Start Location</label>
                        <input type="text" id="start_location" name="start_location" class="form-control" value="Cebu North Bus Terminal (SM City)" style="background-color: #e9ecef;">
                        <small class="text-muted">Fixed starting point for all routes</small>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label for="end_location" class="form-label">Destination <span class="text-danger">*</span></label>
                        <input type="text" id="end_location" name="end_location" class="form-control" required placeholder="Click on map to select destination">
                        <small class="text-muted">Auto-filled from map selection</small>
                        <div class="invalid-feedback" id="end_location_error"></div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-3 mb-3">
                    <label for="route_fare" class="form-label">Route Fare <span class="text-danger">*</span></label>
                    <div class="input-group">
                        <span class="input-group-text">&#8369;</span>
                        <input type="number" step="0.01" id="route_fare" name="route_fare" class="form-control" required>
                    </div>
                    <small class="text-muted">Auto-calculated based on distance and bus type</small>
                    </div>
                    <div class="col-md-3 mb-3">
                        <label for="route_status" class="form-label">Status <span class="text-danger">*</span></label>
                        <select id="route_status" name="status" class="form-select" required>
                            <option value="inactive">Inactive</option>
                            <option value="active">Active</option>
                        </select>
                        <div class="invalid-feedback" id="status_error"></div>
                    </div>
                    <div class="col-md-3 mb-3">
                        <label for="bus_type" class="form-label">Bus Type <span class="text-danger">*</span></label>
                        <select id="bus_type" name="bus_type" class="form-select" required>
                            <option value="regular">Regular (Non Air-Con)</option>
                            <option value="aircon">Air-Conditioned</option>
                        </select>
                        <div class="invalid-feedback" id="bus_type_error"></div>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label">Return Trip Route</label>
                    <div id="returnTripInfo" class="alert alert-info mb-0 py-2 d-flex align-items-center gap-2">
                        <i class="fas fa-exchange-alt"></i>
                        <span id="returnTripInfoText">A return trip route will be automatically created when you save.</span>
                    </div>
                </div>

                <div class="mb-3">
                    <label for="description" class="form-label">Description</label>
                    <textarea id="description" name="description" class="form-control" rows="3"></textarea>
                    <div class="invalid-feedback" id="description_error"></div>
                </div>

                <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-secondary" onclick="hideRouteForm()">
                        <i class="fas fa-times me-2"></i>Cancel
                    </button>
                    <button type="submit" class="btn btn-primary" id="saveRouteBtn">
                        <i class="fas fa-save me-2"></i>Save Route
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Routes Table -->
    <div class="card border-0 bg-white shadow-sm mt-3">
        <div class="card-body p-0"> 
            @if(isset($routes) && $routes->count() > 0)
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Terminal</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>Route Fare</th>
                            <th>Duration</th>
                            <th>Distance</th>
                            <th>Bus Type</th>
                            <th>Status</th>
                            <th>Return Trip</th>
                            <th width="140px">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($routes as $route)
                        <tr>
                            <td class="fw-bold">{{ $route->code }}</td>
                            <td>{{ $route->name }}</td>
                            <td><span class="badge bg-secondary text-uppercase">{{ $route->terminal ?? '—' }}</span></td>
                            <td>{{ $route->start_location }}</td>
                            <td>{{ $route->end_location }}</td>
                            <td>&#8369;{{ number_format($route->route_fare ?? ($route->regular_price ?? 0), 2) }}</td>
                            <td>{{ $route->estimated_duration ?? '-' }} mins</td>
                            <td>{{ $route->distance_km ?? '-' }} km</td>
                            <td>
                            @if($route->bus_type == 'aircon')
                                <span class="badge bg-info">Air-Con</span>
                            @else
                                <span class="badge bg-warning text-dark">Regular</span>
                            @endif
                            </td>
                            <td>
                            @if($route->status == 'active')
                                <span class="badge bg-success">Active</span>
                            @else
                                <span class="badge bg-secondary">Inactive</span>
                            @endif
                            </td>
                            <td>
                                @if($route->return_geometry)
                                    @php
                                        // Try to pick the *municipality* from the end_location string.
                                        // Mapbox addresses look like:
                                        //   "Bogo, Cebu, Philippines"                              -> "Bogo"
                                        //   "Danao City, Cebu, Philippines"                       -> "Danao City"
                                        //   "Tinaan-Sindulan Road Tinaan, Naga, Cebu, Philippines"-> "Naga"
                                        // If the first comma-segment looks like a street/landmark
                                        // (contains Road/Street/etc. or is unusually long), fall
                                        // back to the second segment which is normally the city.
                                        $parts  = array_values(array_filter(array_map('trim', explode(',', $route->end_location ?? ''))));
                                        $first  = $parts[0] ?? '';
                                        $second = $parts[1] ?? '';
                                        $looksLikeStreet = (bool) preg_match('/\b(Road|Street|Avenue|Highway|Hwy|Drive|Blvd|Boulevard|Rd|St\.?|Ave|Lane|Ln|Sitio|Purok)\b/i', $first);
                                        $tooLong = mb_strlen($first) > 18;
                                        $returnFrom = (($looksLikeStreet || $tooLong) && $second !== '') ? $second : $first;
                                        $returnTo   = trim(explode(' ', $route->start_location ?? '')[0]) ?: 'Terminal';
                                        $returnLabel = ($returnFrom ?: '—') . ' to ' . $returnTo;
                                    @endphp
                                    <span class="badge bg-primary text-truncate" style="max-width: 180px; display: inline-block; vertical-align: middle;" title="{{ $returnLabel }}">
                                        <i class="fas fa-exchange-alt me-1"></i>{{ $returnLabel }}
                                    </span>
                                @else
                                    <span class="text-muted small">—</span>
                                @endif
                            </td>
                            <td>
                                <div class="btn-group" role="group">
                                    <button class="btn btn-sm btn-outline-primary" onclick="viewRoute({{ $route->id }})" title="View">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary" onclick="editRoute({{ $route->id }})" title="Edit">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" onclick="deleteRoute({{ $route->id }}, @js($route->name))" title="Delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>

            <!-- Bootstrap Pagination -->
            @if($routes->hasPages())
            <div class="mt-4 d-flex justify-content-between align-items-center">
                <div>
                    <p class="text-muted mb-0">
                        Showing {{ $routes->firstItem() }} to {{ $routes->lastItem() }} of {{ $routes->total() }} results
                    </p>
                </div>
                <nav aria-label="Routes pagination">
                    <ul class="pagination pagination-sm mb-0">
                        {{-- Previous Page Link --}}
                        @if ($routes->onFirstPage())
                            <li class="page-item disabled"><span class="page-link">Previous</span></li>
                        @else
                            <li class="page-item"><a class="page-link" href="{{ $routes->previousPageUrl() }}&{{ http_build_query(request()->except('page')) }}">Previous</a></li>
                        @endif

                        {{-- Pagination Elements --}}
                        @foreach ($routes->getUrlRange(1, $routes->lastPage()) as $page => $url)
                            @if ($page == $routes->currentPage())
                                <li class="page-item active"><span class="page-link">{{ $page }}</span></li>
                            @else
                                <li class="page-item"><a class="page-link" href="{{ $url }}&{{ http_build_query(request()->except('page')) }}">{{ $page }}</a></li>
                            @endif
                        @endforeach

                        {{-- Next Page Link --}}
                        @if ($routes->hasMorePages())
                            <li class="page-item"><a class="page-link" href="{{ $routes->nextPageUrl() }}&{{ http_build_query(request()->except('page')) }}">Next</a></li>
                        @else
                            <li class="page-item disabled"><span class="page-link">Next</span></li>
                        @endif
                    </ul>
                </nav>
            </div>
            @endif
            @else
            <div class="text-center py-5">
                <i class="fas fa-route fa-3x text-muted mb-3"></i>
                <h4>No routes found</h4>
                @if(request()->hasAny(['search', 'status', 'terminal', 'bus_type']))
                    <p class="text-muted">No routes match your search criteria.</p>
                    <a href="{{ route('sysadmin.routes') }}" class="btn btn-outline-primary">
                        <i class="fas fa-arrow-left me-1"></i> View All Routes
                    </a>
                @else
                    <p class="text-muted">Add your first route using the button above.</p>
                @endif
            </div>
            @endif
        </div>
    </div>
</div>

<!-- Delete Route Confirmation Modal (Bootstrap — matches Schedule panel) -->
<div class="modal fade" id="deleteRouteModal" tabindex="-1" aria-labelledby="deleteRouteModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header bg-danger text-white">
                <h5 class="modal-title mb-0" id="deleteRouteModalLabel">
                    <i class="fas fa-trash-alt me-2"></i>Delete Route
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <p class="mb-2">Are you sure you want to delete this route?</p>
                <p class="mb-0 text-muted small" id="deleteRouteModalRouteName"></p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="cancelDeleteRouteBtn">Cancel</button>
                <button type="button" class="btn btn-danger" id="confirmDeleteRouteBtn">
                    <i class="fas fa-trash me-1"></i>Delete
                </button>
            </div>
        </div>
    </div>
</div>

<!-- View Route Modal -->
<!-- <div id="viewRouteModal" class="position-fixed top-0 start-0 w-100 h-100" style="background: rgba(0,0,0,0.5); z-index: 1050; display: none;">
    <div class="d-flex align-items-center justify-content-center h-100 p-3">
        <div class="bg-white rounded shadow-lg" style="max-width: 800px; width: 100%;">
            <div class="bg-info text-white p-3 rounded-top d-flex justify-content-between align-items-center">
                <h5 class="mb-0">
                    <i class="fas fa-eye me-2"></i>Route Details
                </h5>
                <button type="button" class="btn-close btn-close-white" onclick="hideViewModal()"></button>
            </div>
            <div class="p-4" id="viewRouteContent">
            </div>
            <div class="p-3 border-top d-flex justify-content-end">
                <button type="button" class="btn btn-secondary" onclick="hideViewModal()">Close</button>
            </div>
        </div>
    </div>
</div> -->
@endsection

@push('scripts')
<script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
<script>
    mapboxgl.accessToken = @json(config('services.mapbox.token'));
</script>
<script src="{{ asset('js/sysadmin-routes.js') }}?v={{ filemtime(public_path('js/sysadmin-routes.js')) }}"></script>
@endpush

