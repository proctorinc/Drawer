# Drawer

## Deploying

- Pushing `main` deploys: Cloud Build trigger `drawer-us-west1` in GCP project `drawer-459014`.
  The `drawer-service-us-west2` trigger (project `dink-380818`) always fails with
  "cloudbuild.yaml not found"; ignore it.
- Deploys do **not** run database migrations. Run them by hand (below).

## Production migrations

Migrations live in `server/migrations` and run with `geni`, from the `server/` directory
(geni reads `./migrations`). Turso needs an auth token in `DATABASE_TOKEN`; the URL alone
gets "empty JWT token".

Check what's pending first:

```bash
cd server && DATABASE_URL="libsql://drawer-db-proctorinc.aws-us-west-2.turso.io" geni status
```

Then apply:

```bash
cd server && DATABASE_URL="libsql://drawer-db-proctorinc.aws-us-west-2.turso.io" geni up
```

`geni up` applies every pending file in `server/migrations`, including uncommitted ones in
the working tree, so check `geni status` against what you mean to ship.
