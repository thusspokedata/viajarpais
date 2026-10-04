# Postgres de viajarpais en la Pi `nextcloud`

La DB de producción corre en el contenedor `viajarpais-db` (servicio `db`
de `docker-compose.yml`), en la misma Pi que la app. Reemplaza a Neon: el
plan free agotaba la cuota de compute y el sitio quedaba en 500.

- **Datos:** volumen Docker `viajarpais_pgdata` en el SSD de la Pi.
  `docker compose down -v` lo borra — no usar `-v`.
- **Red:** sin puertos publicados. Solo `web` la alcanza (`db:5432`).
  Para consultas ad-hoc: `ssh nextcloud 'docker exec -it viajarpais-db psql -U viajarpais'`.
- **Migraciones:** las aplica el deploy (`prisma migrate deploy` en
  `.github/workflows/deploy.yml`) antes de recrear el contenedor `web`.
- **Backups:** `viajarpais-backup.timer` (03:00) → `pg_dump -Fc` + restic
  al repo del homelab en `.38`, tag `viajarpais`, retención 14d/8w/12m.
  Aviso por Telegram en éxito y fallo.

## Secrets (solo en la Pi, fuera de git)

`/home/kilo/viajarpais/db.env` (0600) — lo lee el servicio `db`:

```
POSTGRES_USER=viajarpais
POSTGRES_DB=viajarpais
POSTGRES_PASSWORD=<openssl rand -hex 32>
```

En `/home/kilo/viajarpais/app.env`, `DATABASE_URL` y `DIRECT_URL` apuntan
los dos a `postgresql://viajarpais:<password>@db:5432/viajarpais`.

## Instalar el backup (una vez)

```bash
sudo install -o root -g root -m 0750 infra/pi/viajarpais-backup.sh /usr/local/sbin/
sudo install -o root -g root -m 0644 infra/pi/viajarpais-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now viajarpais-backup.timer
sudo systemctl start viajarpais-backup.service   # primera corrida manual
cat /var/backups/viajarpais/last-backup.status
```

Reusa `/root/.restic-password` y `/root/.telegram-creds` (los mismos que
`pulsia-backup`).

## Restaurar desde backup

```bash
sudo -i
export RESTIC_PASSWORD_FILE=/root/.restic-password
export RESTIC_REPOSITORY=sftp:kilo@192.168.178.38:/mnt/backup/restic-repo
restic snapshots --tag viajarpais
restic restore <snapshot-id> --target /tmp/vp-restore
docker stop viajarpais
docker exec -i viajarpais-db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl' \
  < /tmp/vp-restore/var/backups/viajarpais/viajarpais.dump
docker start viajarpais
```

## Cutover Neon → Pi (una sola vez)

Neon rechaza hasta conexiones de lectura mientras la cuota está agotada,
así que el dump se hace el día que resetea.

1. Mergear el PR con el servicio `db` y confirmar que `viajarpais-db` está
   healthy (el deploy lo levanta vacío; `web` sigue apuntando a Neon).
2. Parar la app para que no haya escrituras durante la copia:
   `docker stop viajarpais`.
3. Dump de Neon con el cliente de Postgres 18 (sirve para cualquier
   versión de server ≤ 18), usando la `DIRECT_URL` actual:
   ```bash
   cd ~/viajarpais && set -a && . ./app.env && set +a
   docker run --rm -e U="$DIRECT_URL" -v "$PWD:/out" postgres:18-alpine \
     sh -c 'pg_dump "$U" -Fc --no-owner --no-acl -f /out/neon-final.dump'
   ```
4. Restore en la Pi:
   ```bash
   docker exec -i viajarpais-db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --exit-on-error' < neon-final.dump
   ```
5. Verificar conteos contra Neon (`Listing`, `Locality`, `user`,
   `_prisma_migrations`) y que `prisma migrate status` diga "up to date".
6. Cambiar `DATABASE_URL` y `DIRECT_URL` en `app.env` a `db:5432` y
   `docker compose up -d` (o re-run del workflow de deploy).
7. Correr el primer backup a mano (ver arriba) y guardar
   `neon-final.dump` fuera de la Pi hasta dar de baja el proyecto Neon.
