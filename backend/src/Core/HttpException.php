<?php

declare(strict_types=1);

namespace App\Core;

final class HttpException extends \RuntimeException
{
    public function __construct(public readonly int $status, string $message, public readonly array $errors = [])
    {
        parent::__construct($message);
    }

    public static function notFound(string $what = 'Resource'): self
    {
        return new self(404, "$what not found");
    }

    public static function forbidden(): self
    {
        return new self(403, 'You do not have permission to perform this action');
    }

    public static function unprocessable(string $message, array $errors = []): self
    {
        return new self(422, $message, $errors);
    }
}
