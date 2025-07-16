# Welcome to the Daily Doodle!

![Daily Doodle image](https://github.com/proctorinc/Drawer/blob/main/public/daily-doodle-1.png)

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

### Update database schema

Locally:

```bash
sqlite3 drawer.db < server/schema.sql
```

Turso:

```bash
turso db shell drawer-db < server/schema.sql
```

## Migrations

- Checkout Turso/Geni docs here: https://turso.tech/blog/database-migrations-with-geni

- To run on dev db:

```bash
DATABASE_URL="sqlite://./drawer.db" geni <COMMAND>
```

To create a migration

```bash
geni new this_cool_new_feature
```

### To apply all pending migrations

```bash
geni up
```

To rollback the last migration

```bash
geni down
```

Check migration status

````bash
geni status
``

### To rollback all migrations

Locally:

```bash
migrate -database "sqlite3://drawer.db" -path server/migrations down
````

Turso:

```bash
turso db migrate rollback drawer-db
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

## Generating VAPID Keys for Push Notifications

To enable web push notifications, you need a VAPID public/private key pair. These are used to authenticate your server and encrypt push messages.

### 1. Install web-push globally (requires Node.js)

```sh
npm install -g web-push
```

### 2. Generate VAPID keys

```sh
web-push generate-vapid-keys
```

You will see output like:

```
Public Key:
BExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Private Key:
8xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Usage

- **Frontend:** Use the public key (e.g., as an environment variable `VITE_VAPID_PUBLIC_KEY`) for subscribing to push notifications.
- **Backend:** Use both the public and private keys to sign and send push notifications.

**Keep your private key secure and do not expose it to the frontend.**
