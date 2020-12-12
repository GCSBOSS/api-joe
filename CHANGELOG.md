# API Joe Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.3.3] - 2020-12-12

### Fixed
- path / being responded with 404

## [v0.3.2] - 2020-12-11

### Added
- config item for ACME challenge server port

## [v0.3.1] - 2020-12-11

### Added
- missing support for params on endpoint paths

## Fixed
- public ws subscriptions receiving broadcast messages
- error when `services` is not defined in the configuration

## [v0.3.0] - 2020-11-20

### Added
- 'exposed' keyword to open service to requests on any path
- multi-domain config for detecting service based on host header
- ACME feature
- Redis to WebSocket backend events feature

### Fixed
- Dockerfile building bug

### Removed
- websocket proxy support

## [v0.2.1] - 2020-04-17

### Changed
- deploy process slightly

## [v0.2.0] - 2020-03-31

### Added
- session uuid in order to not expose the actual claim data

### Fixed
- re-applying gzip compression when reading from services
- claim data not being proxied to websocket requests
- unwanted headers passed from services to client

## [v0.1.3] - 2020-02-21

### Added
- support for proxying WebSocket connections to services

## [v0.1.2] - 2020-02-14

### Changed
- nodecaf patch version (upgrade)
- app name attribute to API Joe

## [v0.1.1] - 2020-02-12

### Added
- setting for the auth request timeout
- optional command line argument for setting config file path
- setting for triggering a webhook on successful auth

### Fixed
- bug when using miliseconds as sesison expiration time (expects seconds)
- docker image error when no external config file was mounted
- docker image to use unprevilleged user by default
- cookie clearing when accessing expired session

### Changed
- logging strategy to new Nodecaf stdout logging
- default port to 9000 regardless of HTTPS

## [v0.1.0] - 2019-10-16
- First officially published version.

[v0.1.0]: https://gitlab.com/GCSBOSS/api-joe/-/tags/v0.1.0
[v0.1.1]: https://gitlab.com/GCSBOSS/api-joe/-/tags/v0.1.1
[v0.1.2]: https://gitlab.com/GCSBOSS/api-joe/-/tags/v0.1.2
[v0.1.3]: https://gitlab.com/GCSBOSS/api-joe/-/tags/v0.1.3
[v0.2.0]: https://gitlab.com/GCSBOSS/api-joe/-/tags/v0.2.0
[v0.3.0]: https://gitlab.com/GCSBOSS/api-joe/-/tags/v0.3.0
[v0.3.1]: https://gitlab.com/GCSBOSS/api-joe/-/tags/v0.3.1
[v0.3.2]: https://gitlab.com/GCSBOSS/api-joe/-/tags/v0.3.2
[v0.3.3]: https://gitlab.com/GCSBOSS/api-joe/-/tags/v0.3.3
