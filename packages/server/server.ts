import { NetworkServer } from "@canvas-js/gossiplog/server";
import { GossipLog } from "@canvas-js/gossiplog/sqlite";
import http from "node:http";
import express from "express";
import cors from "cors";
import stoppable from "stoppable";
import { WebSocketServer } from "ws";

const port = 8001;

// create the message log
const gossipLog = new GossipLog({
  // no need for an apply message
  apply: () => {},
  topic: "activity-tracker",
});

const api = express();
api.use(cors());

const server = stoppable(http.createServer(api));
const network = new NetworkServer(gossipLog);
const wss = new WebSocketServer({ server, perMessageDeflate: false });
wss.on("connection", network.handleConnection);

const controller = new AbortController();
controller.signal.addEventListener("abort", () => {
  console.log("[canvas] Stopping HTTP API server...");
  network.close();
  wss.close(() =>
    server.stop(() => console.log("[canvas] HTTP API server stopped."))
  );
});

await new Promise<void>((resolve) => server.listen(port, resolve));

let stopping = false;
process.on("SIGINT", async () => {
  if (stopping) {
    process.exit(1);
  } else {
    stopping = true;
    process.stdout.write(
      `\n${"Received SIGINT, attempting to exit gracefully. ^C again to force quit."}\n`
    );

    controller.abort();
  }
});
