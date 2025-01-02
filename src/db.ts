import { Dexie, type EntityTable } from "dexie";

export interface LogEntry {
  timestamp: string;
  activity: string;
}

const db = new Dexie("LogEntriesDatabase") as Dexie & {
  logEntries: EntityTable<
    LogEntry & { messageId: string },
    "messageId" // primary key "messageId" (for the typings only)
  >;
};

db.version(1).stores({
  logEntries: "++messageId, timestamp, activity", // primary key "id" (for the runtime!)
});

export { db };
