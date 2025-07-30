@extends('layouts.app')
@section('content')
<div class="row justify-content-center mt-3">
    <div class="col-md-8">
        <div class="card">
            <div class="card-header">
                <div class="float-start">
                    Space Information
                </div>
                <div class="float-end">
                    <a href="{{ route('spaces.index') }}" class="btn btn-primary btn-sm">&larr; Back</a>
                </div>
            </div>
            <div class="card-body">
                <div class="row">
                    <label for="space_id" class="col-md-4 col-form-label text-md-end text-start"><strong>Space ID:</strong></label>
                    <div class="col-md-6" style="line-height:35px;">
                        {{ $spaces->space_id }}
                    </div>
                </div>
                <div class="row">
                    <label for="location" class="col-md-4 col-form-label text-md-end text-start"><strong>Location:</strong></label>
                    <div class="col-md-6" style="line-height:35px;">
                        {{ $spaces->location }}
                    </div>
                </div>
                <div class="row">
                    <label for="is_occupied" class="col-md-4 col-form-label text-md-end text-start"><strong>Is Occupied?:</strong></label>
                    <div class="col-md-6" style="line-height:35px;">
                        @if($spaces->is_occupied)
                        <span class="badge bg-danger">Yes</span>
                        @else
                        <span class="badge bg-success">No</span>
                        @endif
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection