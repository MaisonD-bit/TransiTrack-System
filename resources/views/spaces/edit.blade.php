@extends('layouts.app')

@section('content')
<div class="row justify-content-center mt-3">
    <div class="col-md-8">
        <div class="card">
            <div class="card-header">
                <div class="float-start">
                    Update Space
                </div>
                <div class="float-end">
                    <a href="{{ route('spaces.index') }}" class="btn btn-primary btn-sm">&larr; Back</a>
                </div>
            </div>
            <div class="card-body">
                <form action="{{ route('spaces.update', $spaces->space_id) }}" method="post">
                    @csrf
                    @method('PUT')
                    <div class="mb-3 row">
                        <label for="location" class="col-md-4 col-form-label text-md-end text-start">Location</label>
                        <div class="col-md-6">
                            <input type="text" class="form-control @error('location') is-invalid @enderror" id="location" name="location" value="{{ old('location', $spaces->location) }}">
                            @error('location')
                            <span class="text-danger">{{ $message }}</span>
                            @enderror
                        </div>
                    </div>

                    <div class=" mb-3 row">
                        <label class="col-md-4 col-form-label text-md-end text-start" for="is_occupied">
                            Is Occupied?
                        </label>    
                        <div class="col-md-6">
                            <input type="hidden" name="is_occupied" value="0">
                            <div class="form-check">
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    name="is_occupied"
                                    id="is_occupied"
                                    value="1"
                                    {{ old('is_occupied', $spaces->is_occupied) ? 'checked' : '' }}>
                                <label class="form-check-label" for="is_occupied">
                                    Yes
                                </label>
                            </div>
                            @error('is_occupied')
                            <div class="text-danger">{{ $message }}</div>
                            @enderror
                        </div>
                    </div>

                    <div class="mb-3 row">
                        <input type="submit" class="col-md-3 offset-md-5 btn btn-primary" value="Update Space">
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>
@endsection