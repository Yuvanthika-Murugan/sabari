<?php

declare(strict_types=1);

namespace App\Core;

final class Request
{
    public const MAX_BODY_BYTES = 8 * 1024 * 1024;

    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $body,
        private readonly array $headers,
    ) {
    }

    public static function capture(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        // Everything after "/api" is the route, wherever the backend is mounted.
        $pos = strpos($uri, '/api');
        $path = $pos === false ? $uri : substr($uri, $pos + 4);
        $path = '/' . trim($path, '/');

        if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
            throw new HttpException(405, 'Method not allowed');
        }

        // Largest legitimate body is a photo (≤ 5 MB, ~6.7 MB as base64). Refuse anything bigger
        // before reading it, so huge uploads cannot exhaust memory.
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > self::MAX_BODY_BYTES) {
            throw new HttpException(413, 'The request is too large');
        }
        $body = [];
        $raw = file_get_contents('php://input', false, null, 0, self::MAX_BODY_BYTES + 1);
        if ($raw !== false && strlen($raw) > self::MAX_BODY_BYTES) {
            throw new HttpException(413, 'The request is too large');
        }
        if ($raw !== '' && $raw !== false) {
            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                throw new HttpException(400, 'Request body must be valid JSON');
            }
            $body = $decoded;
        }

        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = $value;
            }
        }
        // Apache may hide Authorization unless .htaccess forwards it.
        $headers['authorization'] ??= $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';

        return new self($method, $path, $_GET, $body, $headers);
    }

    public function header(string $name): string
    {
        return (string) ($this->headers[strtolower($name)] ?? '');
    }

    public function bearerToken(): ?string
    {
        if (preg_match('/^Bearer\s+(\S+)$/i', $this->header('authorization'), $m)) {
            return $m[1];
        }
        return null;
    }

    public function input(): Input
    {
        return new Input($this->body);
    }
}
