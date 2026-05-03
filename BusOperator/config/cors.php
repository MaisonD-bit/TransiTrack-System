<?php

return [
    // Match all paths so nested API routes always receive CORS headers.
    'paths' => ['*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['*'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*', 'Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'ngrok-skip-browser-warning'],
    'exposed_headers' => [],
    'max_age' => 86400,
    'supports_credentials' => false,
];