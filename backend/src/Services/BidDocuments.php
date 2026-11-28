<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\HttpException;

/**
 * Scanned documents for bid payments (Aadhaar, surety forms, cheque leaves…).
 * Uploads arrive as data URLs; only JPG / PNG / WebP images and PDFs up to 5 MB are
 * accepted, checked by their content, not the name. They are stored outside the web
 * root (backend/storage/bid-documents) under a random name and served only through
 * the API to signed-in office users.
 */
final class BidDocuments
{
    public const MAX_BYTES = 5 * 1024 * 1024;
    private const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];

    /** Saves the file and returns [storedName, mime, size]. */
    public static function store(string $dataUrl): array
    {
        $invalid = fn (string $message) => HttpException::unprocessable('Please correct the highlighted fields', ['file' => $message]);
        if (!preg_match('#^data:([a-z]+/[a-z0-9.+-]+);base64,(.+)$#s', $dataUrl, $m)) {
            throw $invalid('Upload a JPG, PNG, WebP image or a PDF');
        }
        $bytes = base64_decode($m[2], true);
        if ($bytes === false || $bytes === '') {
            throw $invalid('The file could not be read');
        }
        if (strlen($bytes) > self::MAX_BYTES) {
            throw $invalid('The file must be smaller than 5 MB');
        }
        $mime = self::sniff($bytes) ?? throw $invalid('Only JPG, PNG, WebP images and PDF files can be uploaded');

        $dir = self::dir();
        if (!is_dir($dir) && !mkdir($dir, 0770, true) && !is_dir($dir)) {
            throw new \RuntimeException("Cannot create $dir");
        }
        $name = bin2hex(random_bytes(16)) . '.' . self::TYPES[$mime];
        if (file_put_contents("$dir/$name", $bytes) === false) {
            throw new \RuntimeException('Could not save the file');
        }
        return [$name, $mime, strlen($bytes)];
    }

    /** The file as a data URL, for viewing in the app. */
    public static function dataUrl(string $storedName, string $mime): string
    {
        $path = self::path($storedName);
        if (!is_file($path)) {
            throw new HttpException(404, 'The file is missing on the server');
        }
        return "data:$mime;base64," . base64_encode((string) file_get_contents($path));
    }

    public static function delete(string $storedName): void
    {
        $path = self::path($storedName);
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private static function sniff(string $bytes): ?string
    {
        if (str_starts_with($bytes, '%PDF-')) {
            return 'application/pdf';
        }
        $info = @getimagesizefromstring($bytes);
        $mime = $info['mime'] ?? '';
        return isset(self::TYPES[$mime]) && $mime !== 'application/pdf' ? $mime : null;
    }

    private static function path(string $storedName): string
    {
        if (!preg_match('/^[a-f0-9]{32}\.(jpg|png|webp|pdf)$/', $storedName)) {
            throw new HttpException(404, 'File not found');
        }
        return self::dir() . '/' . $storedName;
    }

    private static function dir(): string
    {
        return dirname(__DIR__, 2) . '/storage/bid-documents';
    }
}
