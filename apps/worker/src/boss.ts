import PgBoss from "pg-boss";

/**
 * pg-boss factory — same Supabase Postgres, separate `pgboss` schema.
 * The queue is the source of truth for job state; no external broker.
 */
export async function createBoss(connectionString: string): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString,
    schema: "pgboss",
    // conservative defaults — financial jobs must not silently drop
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    expireInHours: 1,
    archiveCompletedAfterSeconds: 60 * 60 * 24 * 7, // 7d archive for forensics
    maintenanceIntervalSeconds: 60,
    monitorStateIntervalSeconds: 60,
  });

  boss.on("error", (err) => {
    console.error(JSON.stringify({ level: "error", msg: "pg-boss error", error: String(err) }));
  });

  await boss.start();
  return boss;
}
