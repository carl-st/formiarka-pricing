# AGENTS.md - Instructions for formiarka-pricing

This file provides project-specific instructions for agents when working on the formiarka-pricing codebase.

## Project Overview

**formiarka-pricing** is a NestJS-based backend service for calculating pricing, primarily for 3D printing services. It integrates with Shopify for order management and provides real-time pricing calculations via WebSockets.

- **Framework**: NestJS 11.x (TypeScript)
- **Package Manager**: pnpm
- **Testing**: Jest
- **Linting**: ESLint + Prettier
- **Container**: Docker

## Codebase Structure

```
src/
├── app.controller.ts      # Main API endpoints
├── app.module.ts         # Root application module
├── app.service.ts        # Core application service
├── main.ts               # Application entry point
├── config/               # Configuration management
│   ├── config.module.ts
│   └── config.service.ts
├── pricing/              # Pricing calculation module
│   ├── dto/
│   ├── pricing.controller.ts
│   ├── pricing.module.ts
│   ├── pricing.service.ts
│   └── gcode.parser.ts
├── shopify/              # Shopify integration
│   ├── dto/
│   ├── interfaces/
│   ├── graphql/
│   ├── shopify.controller.ts
│   ├── shopify.module.ts
│   ├── shopify.service.ts
│   └── webhook.service.ts
├── events/               # WebSocket events
│   ├── events.gateway.ts
│   ├── events.module.ts
│   └── events.gateway.spec.ts
└── cleanup/              # Cleanup tasks
    ├── cleanup.module.ts
    └── cleanup.service.ts

test/                   # E2E tests
bruno/                  # API collection (Bruno)
configs/                # Printer configurations
```

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install dependencies |
| `pnpm run start` | Start in development mode |
| `pnpm run start:dev` | Start with hot reload |
| `pnpm run start:prod` | Start production build |
| `pnpm run build` | Build TypeScript to JavaScript |
| `pnpm run lint` | Run ESLint with auto-fix |
| `pnpm run format` | Run Prettier formatting |
| `pnpm run test` | Run unit tests |
| `pnpm run test:e2e` | Run end-to-end tests |
| `pnpm run test:cov` | Run tests with coverage |
| `pnpm run test:watch` | Run tests in watch mode |

## Environment Variables

Required environment variables (see `.env.example`):

- `PORT` - Server port (default: 3001)
- `CURRENCY` - Pricing currency (default: PLN)
- `FILAMENT_COST_PER_KG` - Cost of filament per kilogram
- `ENERGY_COST_PER_KWH` - Energy cost per kilowatt-hour
- `PRINTER_POWER_W` - Printer power consumption in watts
- `HOURLY_RATE` - Base hourly rate
- `MAINTENANCE_RATE_PER_HOUR` - Maintenance cost per hour
- `MARKUP_PCT` - Markup percentage
- `MIN_JOB_FEE` - Minimum fee per job
- `PRUSA_CONFIG_BUNDLE` - Path to Prusa printer configuration
- `TMP_DIR` - Temporary directory path
- `SHOPIFY_SHOP_NAME` - Shopify store name
- `SHOPIFY_ADMIN_API_TOKEN` - Shopify Admin API token
- `SHOPIFY_SHARED_SECRET` - Shopify webhook shared secret
- `HOST` - Public host URL

## Technology Stack

### Core Dependencies
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` - NestJS framework
- `@nestjs/websockets`, `@nestjs/platform-socket.io` - WebSocket support
- `@nestjs/swagger` - API documentation
- `@nestjs/schedule` - Scheduled tasks
- `@shopify/shopify-api`, `@shopify/admin-api-client` - Shopify integration
- `class-validator`, `class-transformer` - DTO validation and transformation
- `rxjs` - Reactive programming

### Development Dependencies
- `@nestjs/cli`, `@nestjs/schematics`, `@nestjs/testing` - NestJS tooling
- `eslint`, `prettier` - Code quality
- `jest`, `ts-jest`, `supertest` - Testing
- `typescript` - TypeScript compiler

## Code Style Guidelines

### TypeScript
- Use strict typing for all functions and variables
- Prefer interfaces over type aliases for object shapes
- Use `@Injectable()` for all provider classes
- Use `@Controller()`, `@Module()`, `@Service()` decorators appropriately

### NestJS Patterns
- Follow NestJS convention for module organization
- Controllers handle HTTP requests and delegate to services
- Services contain business logic
- Use DTOs for request/response validation
- Use interfaces for data shapes (especially from external APIs)

### Naming Conventions
- Classes: PascalCase (e.g., `PricingService`, `ShopifyController`)
- Files: kebab-case (e.g., `pricing.service.ts`, `gcode.parser.ts`)
- Variables: camelCase (e.g., `filamentCostPerKg`, `printerPowerW`)
- Constants: UPPER_SNAKE_CASE (e.g., `MIN_JOB_FEE`)
- Interfaces: PascalCase with `I` prefix (e.g., `IDraftOrder`)

### Testing
- Unit tests: `*.spec.ts` files alongside source files
- E2E tests: In the `test/` directory
- Use `@nestjs/testing` for testing NestJS applications
- Mock external services (Shopify, etc.) in tests

## Git Guidelines

- Use meaningful commit messages
- Prefer small, focused commits
- Use branch naming: `feature/`, `fix/`, `refactor/`, `docs/`, `chore/` prefixes
- Current branch: `inpost` (feature branch)
- Main branch: `main`

### Commit Message Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Docker

### Development
```bash
# Build development image
docker build -f Dockerfile.dev -t formiarka-pricing:dev .

# Run with hot reload
docker run --env-file ".env" -v $(pwd):/app -p 3001:3001 formiarka-pricing:dev
```

### Production
```bash
docker build -t carlst/formiarka-pricing:latest .
docker run --env-file ".env" -d --name formiarka-pricing -p 3001:3001 carlst/formiarka-pricing:latest
```

## Common Tasks

### Adding a new module
1. Create directory under `src/`
2. Create `<module>.module.ts` with `@Module()` decorator
3. Create `<module>.service.ts` with `@Injectable()`
4. Create `<module>.controller.ts` if HTTP endpoints needed
5. Import the module in `app.module.ts`

### Adding a new API endpoint
1. Add route handler in appropriate controller
2. Create DTO for request validation (if needed)
3. Implement business logic in service
4. Add corresponding tests

### Shopify Integration
- Use `@shopify/shopify-api` for Shopify API calls
- Webhook validation uses `SHOPIFY_SHARED_SECRET`
- Admin API uses `SHOPIFY_ADMIN_API_TOKEN`
- GraphQL queries in `src/shopify/graphql/queries.ts`

### Pricing Calculation
- Main logic in `src/pricing/pricing.service.ts`
- G-code parsing in `src/pricing/gcode.parser.ts`
- Configuration loaded from `PRUSA_CONFIG_BUNDLE`

## Important Files Reference

| File | Purpose |
|------|---------|
| `src/main.ts` | Application bootstrap |
| `src/app.module.ts` | Root module with all feature modules |
| `src/pricing/pricing.service.ts` | Core pricing calculation logic |
| `src/shopify/shopify.service.ts` | Shopify integration |
| `src/config/config.service.ts` | Configuration service |
| `src/events/events.gateway.ts` | WebSocket gateway |
| `src/cleanup/cleanup.service.ts` | Cleanup scheduled tasks |

## External Integrations

- **Shopify**: Order management, webhooks, GraphQL API
- **Socket.IO**: Real-time events for pricing updates
- **Swagger**: API documentation at `/api`

## Vibe-Specific Instructions

- Always run `pnpm run lint` and `pnpm run format` before committing
- Prefer NestJS-native solutions over custom implementations
- Use dependency injection for all service dependencies
- Mock external API calls in tests
- When modifying pricing logic, verify calculations match business requirements
- When modifying Shopify integration, test with Shopify API mocks
