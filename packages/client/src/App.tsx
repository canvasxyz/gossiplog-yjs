import { AbstractGossipLog, SignedMessage } from "@canvas-js/gossiplog";
import { Signer } from "@canvas-js/interfaces";
import { deleteDB } from "idb";
import { GossipLog as IdbGossipLog } from "@canvas-js/gossiplog/idb";
import { ed25519 } from "@canvas-js/signatures";
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";

type InsertActionUpdate = {
  type: "insert";
  index: number;
  content: string;
};
type DeleteActionUpdate = {
  type: "delete";
  index: number;
  length: number;
};

type DiffUpdate = {
  type: "diff";
  data: Uint8Array;
};

type Update = InsertActionUpdate | DeleteActionUpdate | DiffUpdate;

function isInsertActionUpdate(
  data: object & { type: any }
): data is InsertActionUpdate {
  return (
    data.type === "insert" &&
    "index" in data &&
    typeof data.index === "number" &&
    "content" in data &&
    typeof data.content === "string"
  );
}

function isDeleteActionUpdate(
  data: object & { type: any }
): data is InsertActionUpdate {
  return (
    data.type === "delete" &&
    "index" in data &&
    typeof data.index === "number" &&
    "length" in data &&
    typeof data.length === "number"
  );
}

function isDiffActionUpdate(
  data: object & { type: any }
): data is InsertActionUpdate {
  return (
    data.type === "diff" && "data" in data && data.data instanceof Uint8Array
  );
}

function isUpdate(data: unknown): data is Update {
  console.log(data);
  if (!(typeof data === "object" && data !== null && "type" in data)) {
    return false;
  }
  return (
    isInsertActionUpdate(data) ||
    isDeleteActionUpdate(data) ||
    isDiffActionUpdate(data)
  );
}

function docFromUpdate(update: Uint8Array): Y.Doc {
  const newDoc = new Y.Doc();
  Y.applyUpdate(newDoc, update);
  return newDoc;
}

const topic = `gossiplog-yjs`;

export function App() {
  const [gossipLog, setGossipLog] = useState<AbstractGossipLog<Update> | null>(
    null
  );
  const [output, setOutput] = useState("");
  const [index, setIndex] = useState(0);
  const [deleteLength, setDeleteLength] = useState(0);
  const [content, setContent] = useState("");

  const stateRef = useRef<Y.Doc>(new Y.Doc({ gc: false }));
  const messagesToAppend = useRef<Update[]>([]);

  useEffect(() => {
    async function initGossipLog() {
      const signer: Signer<Update> = ed25519.create();
      const gossipLog = await IdbGossipLog.open({
        validatePayload: isUpdate,
        signer,
        apply: (signedMessage: SignedMessage<Update>) => {
          // this is a crude way of determining whether the message was created with append or insert
          // because it is technically possible that two peers could have the same public key
          const isAppend =
            signedMessage.signature.publicKey === signer.publicKey;
          const payload = signedMessage.message.payload;
          if (payload.type === "delete") {
            if (isAppend) {
              // create a diff and send it
              const state0 = Y.encodeStateAsUpdate(stateRef.current);
              // don't modify the doc in the react state
              const docCopy = docFromUpdate(state0);
              docCopy.getText().delete(payload.index, payload.length);
              const state1 = Y.encodeStateAsUpdate(docCopy);
              const diff = Y.diffUpdate(
                state1,
                Y.encodeStateVectorFromUpdate(state0)
              );
              messagesToAppend.current.push({ type: "diff", data: diff });
            }
          } else if (payload.type === "insert") {
            if (isAppend) {
              // create a diff and send it
              const state0 = Y.encodeStateAsUpdate(stateRef.current);
              // don't modify the doc in the react state
              const docCopy = docFromUpdate(state0);
              docCopy.getText().insert(payload.index, payload.content);
              const state1 = Y.encodeStateAsUpdate(docCopy);
              const diff = Y.diffUpdate(
                state1,
                Y.encodeStateVectorFromUpdate(state0)
              );
              messagesToAppend.current.push({ type: "diff", data: diff });
            }
          } else if (payload.type === "diff") {
            // apply the diff
            Y.applyUpdate(stateRef.current, payload.data);
          }
          // update the rendered text
          setOutput(stateRef.current.getText().toJSON());
        },
        topic,
      });
      await gossipLog.connect("ws://localhost:8001");
      setGossipLog(gossipLog);
    }
    initGossipLog();
  }, []);

  const clear = useCallback(async () => {
    await deleteDB(`canvas/v1/${topic}`, {});
  }, []);

  async function flushMessages() {
    // we are using a queue instead of calling `gossipLog.append` directly because after applying a message
    // we may want to schedule subsequent messages
    if (!gossipLog) {
      return;
    }
    while (messagesToAppend.current.length > 0) {
      const messageToAppend = messagesToAppend.current.shift();
      if (messageToAppend) {
        await gossipLog.append(messageToAppend);
      }
    }
  }

  const outputArr = Array.from(output);
  return (
    <div style={styles.container}>
      <span>To select an index, click one of the numbered buttons below:</span>
      <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
        <div style={{ display: "flex", flexDirection: "row", gap: "5px" }}>
          <button onClick={() => setIndex(0)}>
            {index === 0 ? <strong>{0}</strong> : 0}
          </button>
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
          onClick={async () => {
            if (!content || !gossipLog) {
              return;
            }
            messagesToAppend.current.push({
              type: "insert",
              index,
              content,
            });
            await flushMessages();
            setIndex(0);
            setContent("");
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
          onClick={async () => {
            if (!gossipLog) {
              return;
            }
            messagesToAppend.current.push({
              type: "delete",
              index,
              length: deleteLength,
            });
            await flushMessages();
            setIndex(0);
            setContent("");
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
