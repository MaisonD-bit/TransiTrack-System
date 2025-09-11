@extends('layouts.app')

@section('content')
<div class="row justify-content-center mt-3">
    <div class="col-md-8">
        <div class="card">
            <div class="card-header d-flex justify-content-between">
                <span>Add New Schedule</span>
                <a href="{{ route('schedules.index') }}" class="btn btn-primary btn-sm">&larr; Back</a>
            </div>
            <div class="card-body">
                <form action="{{ route('schedules.store') }}" method="POST">
                    @csrf

                    {{-- Bus --}}
                    <div class="mb-3 row">
                        <label for="bus_id" class="col-md-4 col-form-label text-md-end text-start">Bus</label>
                        <div class="col-md-6">
                            <select name="bus_id" id="bus_id" class="form-select @error('bus_id') is-invalid @enderror">
                                <option value="">-- Select Bus --</option>
                                @foreach($buses as $bus)
                                    <option value="{{ $bus->id }}" {{ old('bus_id') == $bus->id ? 'selected' : '' }}>
                                        {{ $bus->plate_number }}
                                    </option>
                                @endforeach
                            </select>
                            @error('bus_id') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    {{-- Driver --}}
                    <div class="mb-3 row">
                        <label for="driver_id" class="col-md-4 col-form-label text-md-end text-start">Driver</label>
                        <div class="col-md-6">
                            <select name="driver_id" id="driver_id" class="form-select @error('driver_id') is-invalid @enderror">
                                <option value="">-- Select Driver --</option>
                                @foreach($drivers as $driver)
                                    <option value="{{ $driver->id }}" {{ old('driver_id') == $driver->id ? 'selected' : '' }}>
                                        {{ $driver->name }}
                                    </option>
                                @endforeach
                            </select>
                            @error('driver_id') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    {{-- Route --}}
                    <div class="mb-3 row">
                        <label for="route_id" class="col-md-4 col-form-label text-md-end text-start">Route</label>
                        <div class="col-md-6">
                            <select name="route_id" id="route_id" class="form-select @error('route_id') is-invalid @enderror">
                                <option value="">-- Select Route --</option>
                                @foreach($routes as $route)
                                    <option value="{{ $route->id }}" {{ old('route_id') == $route->id ? 'selected' : '' }}>
                                        {{ $route->name }}
                                    </option>
                                @endforeach
                            </select>
                            @error('route_id') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    {{-- Date --}}
                    <div class="mb-3 row">
                        <label for="date" class="col-md-4 col-form-label text-md-end text-start">Date</label>
                        <div class="col-md-6">
                            <input type="date" name="date" id="date" class="form-control @error('date') is-invalid @enderror" value="{{ old('date') }}">
                            @error('date') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    {{-- Start Time --}}
                    <div class="mb-3 row">
                        <label for="start_time" class="col-md-4 col-form-label text-md-end text-start">Start Time</label>
                        <div class="col-md-6">
                            <input type="time" name="start_time" id="start_time" class="form-control @error('start_time') is-invalid @enderror" value="{{ old('start_time') }}">
                            @error('start_time') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    {{-- End Time --}}
                    <div class="mb-3 row">
                        <label for="end_time" class="col-md-4 col-form-label text-md-end text-start">End Time</label>
                        <div class="col-md-6">
                            <input type="time" name="end_time" id="end_time" class="form-control @error('end_time') is-invalid @enderror" value="{{ old('end_time') }}">
                            @error('end_time') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    {{-- Status --}}
                    <div class="mb-3 row">
                        <label for="status" class="col-md-4 col-form-label text-md-end text-start">Status</label>
                        <div class="col-md-6">
                            <select name="status" id="status" class="form-select @error('status') is-invalid @enderror">
                                <option value="scheduled" {{ old('status') == 'scheduled' ? 'selected' : '' }}>Scheduled</option>
                                <option value="active" {{ old('status') == 'active' ? 'selected' : '' }}>Active</option>
                                <option value="completed" {{ old('status') == 'completed' ? 'selected' : '' }}>Completed</option>
                            </select>
                            @error('status') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    {{-- Notes --}}
                    <div class="mb-3 row">
                        <label for="notes" class="col-md-4 col-form-label text-md-end text-start">Notes</label>
                        <div class="col-md-6">
                            <textarea name="notes" id="notes" class="form-control @error('notes') is-invalid @enderror" rows="3">{{ old('notes') }}</textarea>
                            @error('notes') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    {{-- Submit --}}
                    <div class="mb-3 row">
                        <div class="col-md-6 offset-md-4">
                            <button type="submit" class="btn btn-primary">Create Schedule</button>
                        </div>
                    </div>

                </form>
            </div>
        </div>
    </div>
</div>
@endsection
