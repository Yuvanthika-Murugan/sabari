<?php

// Copy this file to config.php and adjust for your environment.
// config.php is git-ignored; this example is used when config.php is missing.

return [
    'db' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'fincollect',
        'user' => 'root',
        'pass' => '',
        // Keep MySQL's CURDATE() in step with PHP's date(); use an offset so
        // MySQL does not need its time zone tables loaded.
        'timezone' => '+05:30',
    ],
    'app' => [
        'timezone' => 'Asia/Kolkata',
        'debug' => false,
        'token_ttl_hours' => 12,
        // Origins allowed to call the API from a browser (the Vite dev server by default).
        'cors_origins' => ['http://localhost:5173', 'http://127.0.0.1:5173'],
    ],
];
