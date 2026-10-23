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
# `&&`: si pg_restore falla, `web` queda parada en vez de arrancar sobre
# una DB restaurada a medias.
docker stop viajarpais \
  && docker exec -i viajarpais-db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl --exit-on-error' \
       < /tmp/vp-restore/var/backups/viajarpais/viajarpais.dump \
  && docker start viajarpais
```

## Cutover Neon → Pi (2026-10-23, arranque desde cero)

Neon rechazaba toda conexión (incluso `pg_dump`) por la cuota agotada y no
había backups, así que la DB de la Pi arrancó **vacía**: migraciones +
seed, sin datos de Neon.

1. `app.env`: `DATABASE_URL` y `DIRECT_URL` → `db:5432` (copia previa en
   `app.env.bak-neon-20261023`).
2. Mergear el PR. El deploy levanta `viajarpais-db`, `migrate deploy` crea
   el schema y recrea `web`. El smoke de `/cuyo` falla hasta tener la
   geografía cargada: es esperado en este primer deploy.
3. Seed (admin + geografía + categorías), desde el workdir del runner:
   ```bash
   cd ~/actions-runner/_work/viajarpais/viajarpais
   docker compose run --rm --no-deps web node_modules/.bin/tsx prisma/seed.ts
   ```
4. Re-run del workflow de deploy → verde.
5. Instalar el timer de backup y correr la primera vez a mano (ver arriba).
6. Dar de baja el proyecto en Neon.
