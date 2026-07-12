import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { Duplex } from "node:stream";
import { app } from "./app";
import { env } from "./config/env";

function sendWebSocketText(socket: Duplex, value: unknown) {
  const payload = Buffer.from(JSON.stringify(value));

  if (payload.length >= 65_536) {
    throw new Error("Status WebSocket payload is too large.");
  }

  const header = payload.length < 126
    ? Buffer.from([0x81, payload.length])
    : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff]);

  socket.write(Buffer.concat([header, payload]));
}

const server = createServer(app);

server.on("upgrade", (request, socket) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (
    !["/status", "/api/status"].includes(url.pathname)
    || request.headers.upgrade?.toLowerCase() !== "websocket"
  ) {
    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const key = request.headers["sec-websocket-key"];
  if (typeof key !== "string") {
    socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const accept = createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n"
    + "Upgrade: websocket\r\n"
    + "Connection: Upgrade\r\n"
    + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  sendWebSocketText(socket, { status: "online", checkedAt: new Date().toISOString() });
  socket.on("error", () => {});
});

server.listen(env.PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Regismatic API listening on port ${env.PORT}`);
});
