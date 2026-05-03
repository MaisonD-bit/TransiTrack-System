@extends('layouts.app')

@section('title', 'Dashboard')

@section('content')
<div class="container-fluid">
    <div class="d-flex align-items-center mb-4">
        <i class="fas fa-home me-3 text-primary fs-4"></i>
        <h2 class="mb-0 fw-bold">Sysadmin dashboard</h2>
    </div>
    <div class="row">
        <div class="col-md-6 col-lg-4">
            <div class="card border-0 shadow-sm border-start border-warning border-4">
                <div class="card-body">
                    <div class="text-muted small">Pending approvals</div>
                    <div class="display-6 fw-bold">{{ $pendingCount }}</div>
                    <a href="{{ route('sysadmin.approvals') }}" class="btn btn-sm btn-outline-primary mt-2">Review queue</a>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
