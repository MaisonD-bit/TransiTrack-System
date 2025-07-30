@extends('layouts.app')

@section('content')
<div class="row justify-content-center mt-3">
    <div class="col-md-8">
        <div class="card">
            <div class="card-header">
                <div class="float-start">
                    Add New Driver
                </div>
                <div class="float-end">
                    <a href="{{ route('drivers.index') }}" class="btn btn-primary btn-sm">&larr; Back</a>
                </div>
            </div>
            <div class="card-body">
                <form action="{{ route('drivers.store') }}" method="post">
                    @csrf
                    <div class="mb-3 row">
                        <label for="name" class="col-md-4 col-form-label text-md-end text-start">Name</label>
                        <div class="col-md-6">
                            <input type="text" class="form-control @error('loacation') is-invalid @enderror" id="name" name="name" value="{{ old('name') }}">
                            @error('name')
                            <span class="text-danger">{{ $message }}</span>
                            @enderror
                        </div>
                    </div>

                    <div class="mb-3 row">
                        <label for="license_number" class="col-md-4 col-form-label text-md-end text-start">License Number</label>
                        <div class="col-md-6">
                            <input type="text" class="form-control @error('loacation') is-invalid @enderror" id="license_number" name="license_number" value="{{ old('license_number') }}">
                            @error('license_number')
                            <span class="text-danger">{{ $message }}</span>
                            @enderror
                        </div>
                    </div>
                    
                    <div class="mb-3 row">
                        <label for="contact_info" class="col-md-4 col-form-label text-md-end text-start">Contact Info</label>
                        <div class="col-md-6">
                            <input type="text" class="form-control @error('contact_info') is-invalid @enderror" id="contact_info" name="contact_info" value="{{ old('contact_info') }}">
                            @error('contact_info')
                            <span class="text-danger">{{ $message }}</span>
                            @enderror
                        </div>

                    <div class="mb-3 row">
                        <input type="submit" class="col-md-3 offset-md-5 btn btn-primary" value="Add Driver">
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>
@endsection