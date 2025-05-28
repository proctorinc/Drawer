Welcome to your new TanStack app!

# Getting started

To run the frontend (port 3000):
```bash
npm run dev
```

To run the backend (port 8002):
```bash
~/.air
```

# Building for production

To build the docker image:

```bash
docker build -t drawer-service .
```

To run the docker container:

```bash
docker run -p 8080:8080 -e TURSO_DATABASE_URL='' -e TURSO_AUTH_TOKEN='' -e FROM_EMAIL='' -e GMAIL_APP_PASSWORD='' -e ENV='' -e BASE_URL='' drawer-service
```

## Database schema

To update the database schema locally:

```bash
sqlite3 drawer.db < server/schema.sql
```

To update the database schema to prod:


```bash
turso db shell drawer-db < server/schema.sql
```

## Migrations

To create a migration

```bash
migrate create -ext sql -dir server/migrations -seq <add_new_feature>
```

To apply all pending migrations
```bash
migrate -database "sqlite3://drawer.db" -path server/migrations up
```

To rollback the last migration
```bash
migrate -database "sqlite3://drawer.db" -path server/migrations down 1
```

To rollback all migrations
```bash
migrate -database "sqlite3://drawer.db" -path server/migrations down
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

## Linting & Formatting

This project uses [eslint](https://eslint.org/) and [prettier](https://prettier.io/) for linting and formatting. Eslint is configured using [tanstack/eslint-config](https://tanstack.com/config/latest/docs/eslint). The following scripts are available:

```bash
npm run lint
npm run format
npm run check
```

## Routing

This project uses [TanStack Router](https://tanstack.com/router). The initial setup is a code based router. Which means that the routes are defined in code (in the `./src/main.tsx` file). If you like you can also use a file based routing setup by following the [File Based Routing](https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing) guide.
