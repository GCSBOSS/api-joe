# [API Joe](https://gitlab.com/GCSBOSS/api-joe)

An API Gateway to easily expose your services to web clients

## Get Started

1. Install with: `npm i -g api-joe`.
2. Setup your [services](#services).
3. Run in the terminal with: `api-joe` (optional argument for the [config file](#configuration) path).

## Get Started with Docker

The official image repository in Docker Hub is `gcsboss/api-joe`.

Run like this: `docker run -p 9000:9000 gcsboss/api-joe`

## Configuration

```toml

port = 9000

[auth]
method = 'POST'
url = 'http://auth-api/path'
timeout = 3000

[redis]
host = 'session'
port = 6379

[services]

[services.my-service]
url = 'http://host-of-service'
endpoints = [
    'POST /something',
    'GET /stuff'
]
```

## Services
To specify your services, use the following structure:

- `Endpoint`: a string with the method and path from your service, you mean to expose
- `Service`: object with:
  - `url`: string with protocol host and port to reach your services
  - `endpoints`: array of `Endpoint`

- `services`: object with:
  - `<service name>`: `Service`

## Reporting Bugs
If you have found any problems with this module, please:

1. [Open an issue](https://gitlab.com/GCSBOSS/api-joe/issues/new).
2. Describe what happened and how.
3. Also in the issue text, reference the label `~bug`.

We will make sure to take a look when time allows us.

## Proposing Features
If you wish to get that awesome feature or have some advice for us, please:
1. [Open an issue](https://gitlab.com/GCSBOSS/api-joe/issues/new).
2. Describe your ideas.
3. Also in the issue text, reference the label `~proposal`.

## Contributing
If you have spotted any enhancements to be made and is willing to get your hands
dirty about it, fork us and
[submit your merge request](https://gitlab.com/GCSBOSS/api-joe/merge_requests/new)
so we can collaborate effectively.
