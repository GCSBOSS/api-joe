# API Joe Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
