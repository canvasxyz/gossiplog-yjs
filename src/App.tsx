import { AbstractGossipLog, SignedMessage } from "@canvas-js/gossiplog";
import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb";
import React, { useCallback, useEffect, useState } from "react";
import { db, LogEntry } from "./db.js";
import { useLiveQuery } from "dexie-react-hooks";

export function App() {
  const log = useLiveQuery(() => db.logEntries.toArray());
  // modeldb?
  const [gossipLog, setGossipLog] =
    useState<AbstractGossipLog<LogEntry> | null>(null);

  useEffect(() => {
    async function initGossipLog() {
      const gossipLog = await IdbGossipLog.open({
        apply: (signedMessage: SignedMessage<LogEntry>) => {
          db.logEntries.add({
            messageId: signedMessage.id,
            timestamp: signedMessage.message.payload.timestamp,
            activity: signedMessage.message.payload.activity,
          });
        },
        topic: "activity-tracker",
      });
      setGossipLog(gossipLog);
    }
    initGossipLog();
  }, []);

  const activities = [
    "Went to the toilet",
    "Ate breakfast",
    "Brushed teeth",
    "Took medication",
    "Exercised",
    "Meditated",
  ];

  const logActivity = useCallback(
    (activity: string) => {
      const timestamp = new Date().toLocaleString();

      if (gossipLog) {
        // write a message to the log
        gossipLog.append<LogEntry>({
          timestamp,
          activity,
        });
      }
    },
    [gossipLog]
  );

  return (
    <div style={styles.container}>
      <h1>Daily Activity Tracker</h1>
      <div style={styles.buttonGrid}>
        {activities.map((activity) => (
          <button
            key={activity}
            onClick={() => logActivity(activity)}
            style={styles.button}
          >
            {activity}
          </button>
        ))}
      </div>
      <div style={styles.logContainer}>
        <h2>Activity Log</h2>
        {(log || []).map((entry, index) => (
          <div key={index} style={styles.logEntry}>
            {entry.timestamp} - {entry.activity}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "Arial, sans-serif",
    maxWidth: "600px",
    margin: "0 auto",
    padding: "20px",
    textAlign: "center",
  },
  buttonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "10px",
    marginBottom: "20px",
  },
  button: {
    padding: "15px",
    fontSize: "16px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "background-color 0.3s",
  },
  logContainer: {
    textAlign: "left",
    maxHeight: "300px",
    overflowY: "auto",
    border: "1px solid #ddd",
    borderRadius: "5px",
    padding: "10px",
  },
  logEntry: {
    borderBottom: "1px solid #eee",
    padding: "5px 0",
  },
};
