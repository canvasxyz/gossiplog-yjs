import { AbstractGossipLog, SignedMessage } from "@canvas-js/gossiplog";
import { deleteDB } from "idb";
import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb";
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";

type InsertUpdate = {
  type: "insert";
  pos: Y.RelativePosition;
  content: string;
  attributes: any;
};
type DeleteUpdate = { type: "delete"; pos: Y.RelativePosition; length: number };
type Update = InsertUpdate | DeleteUpdate;

export function App() {
  // modeldb?
  const [gossipLog, setGossipLog] = useState<AbstractGossipLog<Update> | null>(
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
        apply: (signedMessage: SignedMessage<Update>) => {
          const update = signedMessage.message.payload;

          const absolutePosition = Y.createAbsolutePositionFromRelativePosition(
            update.pos,
            stateRef.current
          );

          if (!absolutePosition) {
            // throw an error - we can't generate an absolute position from this relative position
            throw new Error(
              `Could not generate absolute position from relative position ${JSON.stringify(
                update.pos
              )}`
            );
          }

          if (update.type === "delete") {
            // do delete to the current state ref
            stateRef.current
              .getText()
              .delete(absolutePosition.index, update.length);
          } else if (update.type === "insert") {
            // do insert to the current state ref
            stateRef.current
              .getText()
              .insert(
                absolutePosition.index,
                update.content,
                update.attributes
              );
          }

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
    async (pos: Y.RelativePosition, content: string, attributes?: Object) => {
      if (!gossipLog) {
        console.log("cannot insert, gossipLog has not been initialised!");
        return;
      }

      await gossipLog.append({ type: "insert", pos, content, attributes });
    },
    [gossipLog]
  );

  const doDelete = useCallback(
    async (pos: Y.RelativePosition, deleteLength: number) => {
      if (!gossipLog) {
        console.log("cannot insert, gossipLog has not been initialised!");
        return;
      }

      await gossipLog.append({ type: "delete", pos, length: deleteLength });
    },
    [gossipLog]
  );

  const clear = useCallback(async () => {
    await deleteDB(`canvas/v1/gossiplog-yjs`, {});
  }, []);

  const outputArr = Array.from(output);
  return (
    <div style={styles.container}>
      <span>To select an index, click one of the numbered buttons below:</span>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", flexDirection: "row", gap: "5px" }}>
          <button onClick={() => setIndex(0)}>
            {index === 0 ? <strong>{0}</strong> : 0}
          </button>
          {stateRef.current &&
            JSON.stringify(
              Y.createRelativePositionFromTypeIndex(
                stateRef.current.getText(),
                0
              )
            )}
        </div>
        {outputArr.map((c, i) => (
          <>
            <span key={`span-${i}`}>{c}</span>
            <div
              key={`meta-${i + 1}`}
              style={{ display: "flex", flexDirection: "row", gap: "5px" }}
            >
              <button onClick={() => setIndex(i + 1)}>
                {index === i + 1 ? <strong>{i + 1}</strong> : i + 1}
              </button>
              {stateRef.current &&
                JSON.stringify(
                  Y.createRelativePositionFromTypeIndex(
                    stateRef.current.getText(),
                    i + 1
                  )
                )}
            </div>
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
            const pos = Y.createRelativePositionFromTypeIndex(
              stateRef.current.getText(),
              index
            );
            doInsert(pos, content).then(() => {
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
            const pos = Y.createRelativePositionFromTypeIndex(
              stateRef.current.getText(),
              index
            );
            doDelete(pos, deleteLength).then(() => {
              setIndex(0);
              setContent("");
            });
          }}
        >
          Submit
        </button>
      </div>
      <button onClick={() => clear()}>Clear</button>
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
