<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\HttpException;

/**
 * Customer and user photos. Uploads arrive as data URLs, are re-encoded to JPEG with GD
 * (which rejects anything that is not a real image and strips metadata), and are
 * stored under public/uploads/{customers|users} with an unguessable file name.
 */
final class Photos
{
    private const FOLDERS = ['customers', 'users'];
    private const MAX_BYTES = 5 * 1024 * 1024;
    private const MAX_SIDE = 600;

    /** Saves the image and returns its path relative to public/, e.g. uploads/customers/ab12….jpg */
    public static function store(string $dataUrl, string $folder = 'customers'): string
    {
        if (!in_array($folder, self::FOLDERS, true)) {
            throw new \InvalidArgumentException("Unknown photo folder $folder");
        }
        $dirPath = "uploads/$folder";
        $invalid = fn (string $message) => HttpException::unprocessable('Please correct the highlighted fields', ['photo' => $message]);

        if (!preg_match('#^data:image/(jpeg|png|webp);base64,(.+)$#s', $dataUrl, $m)) {
            throw $invalid('Upload a JPG, PNG or WebP image');
        }
        $bytes = base64_decode($m[2], true);
        if ($bytes === false || strlen($bytes) > self::MAX_BYTES) {
            throw $invalid('The photo must be smaller than 5 MB');
        }
        $image = @imagecreatefromstring($bytes);
        if ($image === false) {
            throw $invalid('This file is not a readable image');
        }

        $w = imagesx($image);
        $h = imagesy($image);
        $scale = min(1, self::MAX_SIDE / max($w, $h));
        $out = imagecreatetruecolor(max(1, (int) round($w * $scale)), max(1, (int) round($h * $scale)));
        imagefill($out, 0, 0, imagecolorallocate($out, 255, 255, 255)); // flatten transparency
        imagecopyresampled($out, $image, 0, 0, 0, 0, imagesx($out), imagesy($out), $w, $h);

        $dir = self::publicPath($dirPath);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new \RuntimeException("Cannot create $dir");
        }
        $path = $dirPath . '/' . bin2hex(random_bytes(16)) . '.jpg';
        if (!imagejpeg($out, self::publicPath($path), 85)) {
            throw new \RuntimeException('Could not save the photo');
        }
        return $path;
    }

    public static function delete(?string $path): void
    {
        if ($path && self::isPhotoPath($path) && is_file(self::publicPath($path))) {
            @unlink(self::publicPath($path));
        }
    }

    public static function isPhotoPath(string $path): bool
    {
        return (bool) preg_match('#^uploads/(' . implode('|', self::FOLDERS) . ')/[a-f0-9]{32}\.jpg$#', $path);
    }

    public static function publicPath(string $path): string
    {
        return dirname(__DIR__, 2) . '/public/' . $path;
    }
}
