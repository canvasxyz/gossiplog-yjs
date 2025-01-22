# gossiplog-yjs

This repo is intended to test syncing Y.js documents over GossipLog. This demo manages the state of a single Y.js text datatype, which supports "insert" and "delete" operations

## Setup

Install dependencies:

```
pnpm i
```

Start the server:

```
cd server
pnpm run build && pnpm run start
```

In another terminal window, start the client:

```
cd client
pnpm run dev --host
```

## How to use

To test out this demo, open the URL that Vite is serving on (see the terminal running the client, it's probably `http://localhost:5173`) in two separate browsers (e.g. Chrome in different profiles/incognito). Clients automatically sync their state via the server over WebSockets. To simulate network partitions, you can throttle the network from the Chrome DevTools, open the "Network" tab and click the dropdown labelled "No throttling" and select "offline". Now try making different insert/delete operations in the two browser windows, then open the same dropdown and select "No throttling" to bring them back online. You should see that the conflicting edits have been resolved according to the Y.js algorithm.
