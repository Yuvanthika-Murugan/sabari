<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Collects validated values from a request body. Each getter records an error
 * instead of throwing, so validate() can report every problem at once.
 */
final class Input
{
    private array $errors = [];

    public function __construct(private readonly array $data)
    {
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->data);
    }

    public function str(string $key, bool $required = false, int $max = 255, string $default = ''): string
    {
        $value = trim((string) ($this->data[$key] ?? ''));
        if ($value === '') {
            if ($required) {
                $this->errors[$key] = 'This field is required';
            }
            return $default;
        }
        if (mb_strlen($value) > $max) {
            $this->errors[$key] = "Must be at most $max characters";
        }
        return $value;
    }

    public function email(string $key, bool $required = true): string
    {
        $value = $this->str($key, $required, 160);
        if ($value !== '' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            $this->errors[$key] = 'Must be a valid email address';
        }
        return strtolower($value);
    }

    /** An Indian mobile number: 10 digits starting with 6-9. Spaces, dashes and a +91/0 prefix are stripped. */
    public function mobile(string $key, bool $required = true): string
    {
        $value = preg_replace('/[\s-]/', '', $this->str($key, $required, 20));
        $value = preg_replace('/^(\+?91|0)(?=\d{10}$)/', '', $value);
        if ($value !== '' && !preg_match('/^[6-9]\d{9}$/', $value)) {
            $this->errors[$key] = 'Enter a valid 10-digit mobile number';
        }
        return $value;
    }

    /** A mobile number, or a landline with its STD code (0 + 10 digits). Optional by default. */
    public function phone(string $key, bool $required = false): string
    {
        $value = preg_replace('/[\s-]/', '', $this->str($key, $required, 20));
        $value = preg_replace('/^\+?91(?=[6-9]\d{9}$)/', '', $value);
        if ($value !== '' && !preg_match('/^(0\d{10}|[6-9]\d{9})$/', $value)) {
            $this->errors[$key] = 'Enter a 10-digit mobile or a landline with STD code';
        }
        return $value;
    }

    /** Largest amount any money field accepts (fits DECIMAL(15,2) with room to spare). */
    public const MAX_AMOUNT = 999_999_999_999;

    /**
     * A plain decimal number such as "1500" or "1500.50". Rejects text, exponents
     * ("1e5"), signs, hex and more than 2 decimal places.
     */
    public function num(string $key, bool $required = false, float $min = 0, ?float $default = 0, float $max = self::MAX_AMOUNT): ?float
    {
        $value = $this->data[$key] ?? '';
        if (is_string($value)) {
            $value = trim($value);
        }
        if ($value === '' || $value === null) {
            if ($required) {
                $this->errors[$key] = 'This field is required';
            }
            return $default;
        }
        $ok = is_int($value) || (is_float($value) && is_finite($value))
            || (is_string($value) && preg_match('/^\d+(\.\d{1,2})?$/', $value));
        if (!$ok) {
            $this->errors[$key] = 'Must be a number (digits only, up to 2 decimals)';
            return $default;
        }
        $n = (float) $value;
        if ($n < $min) {
            $this->errors[$key] = 'Must be at least ' . self::fmt($min);
        } elseif ($n > $max) {
            $this->errors[$key] = 'Must be at most ' . self::fmt($max);
        }
        return $n;
    }

    /** A whole number; "2.5" or "abc" is an error rather than being truncated. */
    public function int(string $key, bool $required = false, int $min = 0, int $max = 1_000_000_000): int
    {
        $value = $this->data[$key] ?? '';
        if (is_string($value)) {
            $value = trim($value);
        }
        if ($value !== '' && $value !== null && !is_int($value) && !(is_string($value) && ctype_digit($value))) {
            $this->errors[$key] = 'Must be a whole number';
            return 0;
        }
        return (int) $this->num($key, $required, $min, 0, $max);
    }

    /** A percentage from 0 to 100. */
    public function percent(string $key, bool $required = true): float
    {
        return (float) $this->num($key, $required, 0, 0, 100);
    }

    /** A person or place name: letters (any language), spaces and . ' - only. */
    public function name(string $key, bool $required = false, int $max = 120): string
    {
        $value = preg_replace('/\s+/u', ' ', $this->str($key, $required, $max));
        if ($value !== '' && !preg_match("/^[\\p{L}\\p{M}][\\p{L}\\p{M} .'-]*$/u", $value)) {
            $this->errors[$key] = 'Use letters only (no digits or symbols)';
        }
        return $value;
    }

    /**
     * Text that must match a fixed format (PIN, IFSC, GSTIN, codes...). Spaces are
     * removed and, with $upper, letters upper-cased before checking.
     */
    public function pattern(string $key, string $regex, string $message, bool $required = false, int $max = 40, bool $upper = true): string
    {
        $value = preg_replace('/\s+/', '', $this->str($key, $required, $max));
        if ($upper) {
            $value = strtoupper($value);
        }
        if ($value !== '' && !preg_match($regex, $value)) {
            $this->errors[$key] = $message;
        }
        return $value;
    }

    public function pincode(string $key, bool $required = false): string
    {
        return $this->pattern($key, '/^[1-9]\d{5}$/', 'Must be a 6-digit PIN code', $required, 10);
    }

    /** UTR / cheque / transaction reference: letters, digits and - / _ only. */
    public function reference(string $key, bool $required = false): string
    {
        return $this->pattern($key, '/^[A-Za-z0-9\/_-]+$/', 'Use letters, digits, - / _ only', $required, 60, false);
    }

    private static function fmt(float $n): string
    {
        return $n == (int) $n ? number_format($n, 0, '.', ',') : (string) $n;
    }

    /** A foreign-key id; returns null when empty and not required. */
    public function id(string $key, bool $required = false): ?int
    {
        $value = $this->data[$key] ?? '';
        if ($value === '' || $value === null) {
            if ($required) {
                $this->errors[$key] = 'This field is required';
            }
            return null;
        }
        if (!ctype_digit((string) $value)) {
            $this->errors[$key] = 'Invalid selection';
            return null;
        }
        return (int) $value;
    }

    public function date(string $key, bool $required = false, ?string $default = null): ?string
    {
        $value = trim((string) ($this->data[$key] ?? ''));
        if ($value === '') {
            if ($required && $default === null) {
                $this->errors[$key] = 'This field is required';
            }
            return $default;
        }
        $d = \DateTime::createFromFormat('Y-m-d', $value);
        if (!$d || $d->format('Y-m-d') !== $value) {
            $this->errors[$key] = 'Must be a date (YYYY-MM-DD)';
            return $default;
        }
        return $value;
    }

    public function time(string $key, string $default): string
    {
        $value = trim((string) ($this->data[$key] ?? ''));
        if ($value === '') {
            return $default;
        }
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $value)) {
            $this->errors[$key] = 'Must be a time (HH:MM)';
            return $default;
        }
        return strlen($value) === 5 ? "$value:00" : $value;
    }

    public function enum(string $key, array $allowed, ?string $default = null): ?string
    {
        $value = (string) ($this->data[$key] ?? '');
        if ($value === '') {
            if ($default === null) {
                $this->errors[$key] = 'This field is required';
            }
            return $default;
        }
        if (!in_array($value, $allowed, true)) {
            $this->errors[$key] = 'Invalid value';
            return $default;
        }
        return $value;
    }

    public function error(string $key, string $message): void
    {
        $this->errors[$key] = $message;
    }

    public function validate(): void
    {
        if ($this->errors) {
            throw HttpException::unprocessable('Please correct the highlighted fields', $this->errors);
        }
    }
}
