// Demonstration adapter only: bounded server memory, explicitly non-durable.
export class MemoryStore {
  durability = "session_only";
  constructor() {
    this.rows = new Map();
  }
  async save(workspace, result) {
    const k = `${workspace}:${result.id}`,
      rows = this.rows.get(k) || [];
    rows.push(structuredClone(result));
    this.rows.set(k, rows.slice(-3));
    if (this.rows.size > 500) this.rows.delete(this.rows.keys().next().value);
  }
  async latest(workspace, id) {
    return structuredClone(this.rows.get(`${workspace}:${id}`)?.at(-1) || null);
  }
}
