import pg from "pg";

const connectionCodes = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN"]);
const connectionMessages = new Set([
  "Connection terminated due to connection timeout",
  "timeout exceeded when trying to connect",
  "Connection terminated unexpectedly",
]);

export class DatabasePool extends pg.Pool {
  connect(callback) {
    const acquisition = this.acquireConnection();
    if (!callback) return acquisition;
    void acquisition.then((client) => callback(null, client, client.release), callback);
  }

  async acquireConnection() {
    try {
      return await super.connect();
    } catch (error) {
      if (this.ending || (!connectionCodes.has(error.code) && !connectionMessages.has(error.message))) throw error;
      // No SQL has run yet. Retry acquisition once, never a query or transaction.
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (this.ending) throw error;
      return super.connect();
    }
  }
}
