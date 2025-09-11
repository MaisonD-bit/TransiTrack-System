@extends('layouts.app')

@section('content')
<div class="row justify-content-center mt-3">
    <div class="col-md-8">
        <div class="card">
            <div class="card-header d-flex justify-content-between">
                <span>Update Route</span>
                <a href="{{ route('routes.index') }}" class="btn btn-primary btn-sm">&larr; Back</a>
            </div>
            <div class="card-body">
                <form action="{{ route('routes.update', $routes->id) }}" method="post">
                    @csrf
                    @method('PUT')

                    <div class="mb-3 row">
                        <label for="name" class="col-md-4 col-form-label text-md-end text-start">Name</label>
                        <div class="col-md-6">
                            <input type="text" class="form-control @error('name') is-invalid @enderror" id="name" name="name" value="{{ old('name', $routes->name) }}">
                            @error('name') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="mb-3 row">
                        <label for="code" class="col-md-4 col-form-label text-md-end text-start">Route Code</label>
                        <div class="col-md-6">
                            <input type="text" class="form-control @error('code') is-invalid @enderror" id="code" name="code" value="{{ old('code', $routes->code) }}">
                            @error('code') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="mb-3 row">
                        <label for="start_location" class="col-md-4 col-form-label text-md-end text-start">Start Location</label>
                        <div class="col-md-6">
                            <input type="text" class="form-control @error('start_location') is-invalid @enderror" id="start_location" name="start_location" value="{{ old('start_location', $routes->start_location) }}">
                            @error('start_location') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="mb-3 row">
                        <label for="end_location" class="col-md-4 col-form-label text-md-end text-start">End Location</label>
                        <div class="col-md-6">
                            <input type="text" class="form-control @error('end_location') is-invalid @enderror" id="end_location" name="end_location" value="{{ old('end_location', $routes->end_location) }}">
                            @error('end_location') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="mb-3 row">
                        <label for="regular_price" class="col-md-4 col-form-label text-md-end text-start">Regular Price</label>
                        <div class="col-md-6">
                            <input type="number" step="0.01" class="form-control @error('regular_price') is-invalid @enderror" id="regular_price" name="regular_price" value="{{ old('regular_price', $routes->regular_price) }}">
                            @error('regular_price') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="mb-3 row">
                        <label for="aircon_price" class="col-md-4 col-form-label text-md-end text-start">Aircon Price</label>
                        <div class="col-md-6">
                            <input type="number" step="0.01" class="form-control @error('aircon_price') is-invalid @enderror" id="aircon_price" name="aircon_price" value="{{ old('aircon_price', $routes->aircon_price) }}">
                            @error('aircon_price') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="mb-3 row">
                        <label for="distance_km" class="col-md-4 col-form-label text-md-end text-start">Distance (km)</label>
                        <div class="col-md-6">
                            <input type="number" step="0.1" class="form-control @error('distance_km') is-invalid @enderror" id="distance_km" name="distance_km" value="{{ old('distance_km', $routes->distance_km) }}">
                            @error('distance_km') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="mb-3 row">
                        <label for="estimated_duration" class="col-md-4 col-form-label text-md-end text-start">Duration (minutes)</label>
                        <div class="col-md-6">
                            <input type="number" class="form-control @error('estimated_duration') is-invalid @enderror" id="estimated_duration" name="estimated_duration" value="{{ old('estimated_duration', $routes->estimated_duration) }}">
                            @error('estimated_duration') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="mb-3 row">
                        <label for="status" class="col-md-4 col-form-label text-md-end text-start">Status</label>
                        <div class="col-md-6">
                            <select class="form-select @error('status') is-invalid @enderror" id="status" name="status">
                                <option value="active" {{ old('status', $routes->status) == 'active' ? 'selected' : '' }}>Active</option>
                                <option value="inactive" {{ old('status', $routes->status) == 'inactive' ? 'selected' : '' }}>Inactive</option>
                            </select>
                            @error('status') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="mb-3 row">
                        <label for="description" class="col-md-4 col-form-label text-md-end text-start">Description</label>
                        <div class="col-md-6">
                            <textarea class="form-control @error('description') is-invalid @enderror" id="description" name="description">{{ old('description', $routes->description) }}</textarea>
                            @error('description') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="mb-3 row">
                        <div class="col-md-6 offset-md-4">
                            <button type="submit" class="btn btn-primary">Update Route</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>
@endsection
