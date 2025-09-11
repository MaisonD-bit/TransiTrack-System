@extends('layouts.app')

@section('content')

<div class="row justify-content-center mt-3">
    <div class="col-md-8">
        <div class="card">
            <div class="card-header d-flex justify-content-between">
                <span>Edit Bus</span>
                <a href="{{ route('bus.index') }}" class="btn btn-primary btn-sm">&larr; Back</a>
            </div>
            <div class="card-body">
                <form action="{{ route('bus.update', $bus->id) }}" method="POST">
                    @csrf
                    @method('PUT')

                    {{-- Plate Number --}}
                    <div class="mb-3">
                        <label for="plate_number">Plate Number</label>
                        <input type="text" id="plate_number" name="plate_number"
                            class="form-control @error('plate_number') is-invalid @enderror"
                            value="{{ old('plate_number', $bus->plate_number) }}">
                        @error('plate_number')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>

                    {{-- Bus Number --}}
                    <div class="mb-3">
                        <label for="bus_number">Bus Number</label>
                        <input type="text" id="bus_number" name="bus_number"
                            class="form-control @error('bus_number') is-invalid @enderror"
                            value="{{ old('bus_number', $bus->bus_number) }}">
                        @error('bus_number')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>

                    {{-- Bus Company --}}
                    <div class="mb-3">
                        <label for="bus_company">Bus Company</label>
                        <input type="text" id="bus_company" name="bus_company"
                            class="form-control @error('bus_company') is-invalid @enderror"
                            value="{{ old('bus_company', $bus->bus_company) }}">
                        @error('bus_company')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>

                    {{-- Model --}}
                    <div class="mb-3">
                        <label for="model">Model</label>
                        <input type="text" id="model" name="model"
                            class="form-control @error('model') is-invalid @enderror"
                            value="{{ old('model', $bus->model) }}">
                        @error('model')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>

                    {{-- Accommodation Type --}}
                    <div class="mb-3">
                        <label for="accommodation_type">Accommodation Type</label>
                        <select id="accommodation_type" name="accommodation_type"
                            class="form-select @error('accommodation_type') is-invalid @enderror">
                            <option value="air-conditioned" {{ old('accommodation_type', $bus->accommodation_type)=='air-conditioned'?'selected':'' }}>Air-Conditioned</option>
                            <option value="deluxe" {{ old('accommodation_type', $bus->accommodation_type)=='deluxe'?'selected':'' }}>Deluxe</option>
                            <option value="super-deluxe" {{ old('accommodation_type', $bus->accommodation_type)=='super-deluxe'?'selected':'' }}>Super-Deluxe</option>
                        </select>
                        @error('accommodation_type')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>

                    {{-- Status --}}
                    <div class="mb-3">
                        <label for="status">Status</label>
                        <select id="status" name="status"
                            class="form-select @error('status') is-invalid @enderror">
                            <option value="active" {{ $bus->status=='active'?'selected':'' }}>Active</option>
                            <option value="inactive" {{ $bus->status=='inactive'?'selected':'' }}>Inactive</option>
                            <option value="maintenance" {{ $bus->status=='maintenance'?'selected':'' }}>Maintenance</option>
                        </select>
                        @error('status')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>

                    {{-- Capacity --}}
                    <div class="mb-3">
                        <label for="capacity">Capacity</label>
                        <input type="number" id="capacity" name="capacity" min="1"
                            class="form-control @error('capacity') is-invalid @enderror"
                            value="{{ old('capacity', $bus->capacity) }}">
                        @error('capacity')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>

                    {{-- Description --}}
                    <div class="mb-3">
                        <label for="description">Description (optional)</label>
                        <textarea id="description" name="description" rows="3"
                            class="form-control @error('description') is-invalid @enderror">{{ old('description', $bus->description) }}</textarea>
                        @error('description')<div class="invalid-feedback">{{ $message }}</div>@enderror
                    </div>

                    <div class="d-flex justify-content-end">
                        <button type="submit" class="btn btn-primary">Update Bus</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    ```

</div>
@endsection