<?php

declare(strict_types=1);

namespace App\Core;

final class Router
{
    /** @var array<int, array{string, string, callable}> */
    private array $routes = [];

    public function get(string $pattern, callable $handler): void
    {
        $this->routes[] = ['GET', $pattern, $handler];
    }

    public function post(string $pattern, callable $handler): void
    {
        $this->routes[] = ['POST', $pattern, $handler];
    }

    public function put(string $pattern, callable $handler): void
    {
        $this->routes[] = ['PUT', $pattern, $handler];
    }

    public function delete(string $pattern, callable $handler): void
    {
        $this->routes[] = ['DELETE', $pattern, $handler];
    }

    /** CRUD routes for a controller exposing index/store/update/destroy. */
    public function resource(string $base, string $controller): void
    {
        $this->get($base, [$controller, 'index']);
        $this->post($base, [$controller, 'store']);
        $this->put("$base/{id}", [$controller, 'update']);
        $this->delete("$base/{id}", [$controller, 'destroy']);
    }

    public function dispatch(Request $request): mixed
    {
        $pathMatched = false;
        foreach ($this->routes as [$method, $pattern, $handler]) {
            $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
            if (!preg_match($regex, $request->path, $m)) {
                continue;
            }
            $pathMatched = true;
            if ($method !== $request->method) {
                continue;
            }
            $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
            if (isset($params['id'])) {
                if (!ctype_digit($params['id'])) {
                    throw HttpException::notFound();
                }
                $params['id'] = (int) $params['id'];
            }
            return $handler($request, ...$params);
        }
        throw $pathMatched ? new HttpException(405, 'Method not allowed') : HttpException::notFound('Endpoint');
    }
}
