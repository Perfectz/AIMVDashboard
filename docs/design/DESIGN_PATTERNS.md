# Design Patterns (APIE)

This project applies APIE principles pragmatically to reduce duplication and improve maintainability.

## Abstraction

### Content file abstraction

- Module: `scripts/services/content_file_service.js`
- Replaces many near-identical save/load handlers with typed config-driven operations.

Benefits:

1. One validation path per content type.
2. Consistent size/error handling.
3. Easier extension for new content types.

### Service base abstraction (browser)

- Module: `ui/services/service-base.js`
- Centralizes dependency and HTTP-client resolution logic used by service modules.

Benefits:

1. Less boilerplate in each service.
2. Consistent failure behavior when dependencies are missing.

## Polymorphism

### Reference entity polymorphism

- Module: `scripts/services/reference_entity_handler.js`
- Same CRUD/upload logic parameterized for `character` and `location` entities.

Benefits:

1. One implementation, multiple entity types.
2. Reduced drift between character/location flows.

### Upload service polymorphism

- Module: `ui/services/reference-upload-service.js`
- Shared upload logic parameterized by endpoint and field name.

Benefits:

1. Fewer copy-paste branches.
2. Consistent upload validation and error mapping.

## Inheritance (Behavioral)

JavaScript prototype inheritance is not used heavily; instead, the project favors composition and config-based specialization. Behavioral inheritance appears through:

1. Shared service contracts across route handlers.
2. Route context injection in `serve_ui.js`.
3. Declarative UI mounts in `ui/ui-layer.js`.

## Encapsulation

### Frontend state encapsulation

- Module: `ui/modules/state.js`
- Encapsulates mutable global state behind `get/set/on` methods.

Benefits:

1. Controlled mutation path.
2. Easier state tracing and future modularization.

### Server encapsulation through services

- Pattern: move complex logic from routes into dedicated services.
- Example: generation flow in `generation_task_service.js`.

Benefits:

1. Route modules stay transport-focused.
2. Business rules are testable in isolation.

## Composition

### Middleware composition

- Modules: `scripts/middleware/*`
- Logger/body/error wrappers compose request handling without framework dependency.

### Multipart parser composition

- Module: `scripts/middleware/busboy-upload.js`
- Shared upload parser reused by reference routes.

## Practical Rules for New Code

1. Add logic to existing abstractions first; do not duplicate route handler branches.
2. Prefer parameterized handlers/services for sibling entities.
3. Keep mutable shared state in `AppState`, not free globals.
4. Use composition before introducing inheritance hierarchies.
5. Keep contracts backward-compatible; extend response fields additively.
