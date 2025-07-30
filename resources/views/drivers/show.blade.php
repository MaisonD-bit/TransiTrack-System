@extends('layouts.app')
@section('content')
<div class="row justify-content-center mt-3">
    <div class="col-md-8">
        <div class="card">
            <div class="card-header">
                <div class="float-start">
                    Driver Information
                </div>
                <div class="float-end">
                    <a href="{{ route('drivers.index') }}" class="btn btn-primary btn-sm">&larr; Back</a>
                </div>
            </div>
            <div class="card-body">
                <div class="row">
                    <label for="space_id" class="col-md-4 col-form-label text-md-end text-start"><strong>Driver ID:</strong></label>
                    <div class="col-md-6" style="line-height:35px;">
                        {{ $drivers->driver_id }}
                    </div>
                </div>

                <div class="row">
                    <label for="license_number" class="col-md-4 col-form-label text-md-end text-start"><strong>License Number:</strong></label>
                    <div class="col-md-6" style="line-height:35px;">
                        {{ $drivers->license_number }}
                    </div>
                </div>

                <div class="row">
                    <label for="contact_info" class="col-md-4 col-form-label text-md-end text-start"><strong>Contact Info:</strong></label>
                    <div class="col-md-6" style="line-height:35px;">
                        {{ $drivers->contact_info }}
                    </div>
                </div>
                
            </div>
        </div>
    </div>
</div>
@endsection