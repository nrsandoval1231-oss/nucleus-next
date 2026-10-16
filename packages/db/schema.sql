-- One owner workspace per instance. Credentials are never stored in evidence.
CREATE TABLE IF NOT EXISTS nucleus_observation (
  workspace text NOT NULL,
  repo_id text NOT NULL,
  evidence_id text NOT NULL,
  source_kind text NOT NULL,
  observed_at timestamptz NOT NULL,
  acquisition jsonb NOT NULL,
  PRIMARY KEY (workspace, repo_id, evidence_id, observed_at)
);
CREATE TABLE IF NOT EXISTS nucleus_snapshot (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace text NOT NULL,
  repo_id text NOT NULL,
  observed_at timestamptz NOT NULL,
  projection jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS nucleus_latest ON nucleus_snapshot(workspace,repo_id,sequence DESC);
