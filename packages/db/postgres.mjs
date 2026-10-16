import pg from "pg";
export class PostgresStore {
  durability = "postgresql";
  constructor(
    connectionString,
    pool = new pg.Pool({ connectionString, max: 4 }),
  ) {
    this.pool = pool;
  }
  async save(workspace, result) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      for (const e of result.evidence)
        await c.query(
          "INSERT INTO nucleus_observation(workspace,repo_id,evidence_id,source_kind,observed_at,acquisition) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
          [
            workspace,
            result.id,
            e.id,
            e.kind,
            e.observed_at,
            JSON.stringify(e),
          ],
        );
      await c.query(
        "INSERT INTO nucleus_snapshot(workspace,repo_id,observed_at,projection) VALUES($1,$2,$3,$4)",
        [workspace, result.id, result.observed_at, JSON.stringify(result)],
      );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async latest(workspace, id) {
    return (
      (
        await this.pool.query(
          "SELECT projection FROM nucleus_snapshot WHERE workspace=$1 AND repo_id=$2 ORDER BY sequence DESC LIMIT 1",
          [workspace, id],
        )
      ).rows[0]?.projection || null
    );
  }
}
