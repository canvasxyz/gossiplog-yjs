import { AbstractGossipLog, SignedMessage } from "@canvas-js/gossiplog";
import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb";
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";

type Diff = { data: Uint8Array };

export function App() {
  // modeldb?
  const [gossipLog, setGossipLog] = useState<AbstractGossipLog<Diff> | null>(
    null
  );
  const [output, setOutput] = useState("");
  const [index, setIndex] = useState(0);
  const [deleteLength, setDeleteLength] = useState(0);
  const [content, setContent] = useState("");

  const stateRef = useRef<Y.Doc>(new Y.Doc({ gc: false }));

  useEffect(() => {
    async function initGossipLog() {
      const gossipLog = await IdbGossipLog.open({
        apply: (signedMessage: SignedMessage<Diff>) => {
          // apply the diff in the signed message to the current state
          Y.applyUpdate(stateRef.current, signedMessage.message.payload.data);

          // update the rendered text
          setOutput(stateRef.current.getText().toJSON());
        },
        topic: "gossiplog-yjs",
      });
      await gossipLog.connect("ws://localhost:8001");
      setGossipLog(gossipLog);
    }
    initGossipLog();
  }, []);

  const doInsert = useCallback(
    async (index: number, content: string, attributes?: Object) => {
      if (!gossipLog) {
        console.log("cannot insert, gossipLog has not been initialised!");
        return;
      }
      // make a copy of the current doc
      const before = Y.snapshot(stateRef.current);
      const updatedState = Y.createDocFromSnapshot(stateRef.current, before);
      // perform the action on it
      updatedState.getText().insert(index, content, attributes);
      // diff it and the current state
      const diff = Y.diffUpdate(
        Y.encodeStateAsUpdate(updatedState),
        Y.encodeStateAsUpdate(stateRef.current)
      );
      // post the diff to gossiplog
      await gossipLog.append<Diff>({ data: diff });
    },
    [gossipLog]
  );

  const doDelete = useCallback(
    async (index: number, deleteLength: number) => {
      if (!gossipLog) {
        console.log("cannot insert, gossipLog has not been initialised!");
        return;
      }
      // make a copy of the current doc
      const before = Y.snapshot(stateRef.current);
      const updatedState = Y.createDocFromSnapshot(stateRef.current, before);
      // perform the action on it
      updatedState.getText().delete(index, deleteLength);
      // diff it and the current state
      const diff = Y.diffUpdate(
        Y.encodeStateAsUpdate(updatedState),
        Y.encodeStateAsUpdate(stateRef.current)
      );
      // post the diff to gossiplog
      await gossipLog.append<Diff>({ data: diff });
    },
    [gossipLog]
  );

  const outputArr = Array.from(output);
  return (
    <div style={styles.container}>
      <span>To select an index, click one of the numbered buttons below:</span>
      <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
        <button onClick={() => setIndex(0)}>
          {index === 0 ? <strong>{0}</strong> : 0}
        </button>
        {outputArr.map((c, i) => (
          <>
            <span key={`span-${i}`}>{c}</span>
            <button key={`button-${i + 1}`} onClick={() => setIndex(i + 1)}>
              {index === i + 1 ? <strong>{i + 1}</strong> : i + 1}
              {/* {i + 1} */}
            </button>
          </>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "row", gap: "4px" }}>
        Insert{" "}
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        ></input>{" "}
        at position {index}:{" "}
        <button
          onClick={() => {
            if (!content) {
              return;
            }

            doInsert(index, content).then(() => {
              setIndex(0);
              setContent("");
            });
          }}
        >
          Submit
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "row", gap: "4px" }}>
        Delete{" "}
        <input
          type="number"
          value={deleteLength}
          onChange={(e) => setDeleteLength(parseInt(e.target.value))}
        ></input>{" "}
        characters at position {index}:
        <button
          onClick={() => {
            doDelete(index, deleteLength).then(() => {
              setIndex(0);
              setContent("");
            });
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "Arial, sans-serif",
    maxWidth: "600px",
    margin: "0 auto",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
};
