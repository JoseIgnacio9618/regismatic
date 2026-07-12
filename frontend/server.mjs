import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const hostname = "0.0.0.0";
const staticDirectory = path.resolve(process.env.STATIC_DIR ?? "/usr/share/nginx/html");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"]
]);

function sendWebSocketText(socket, value) {
  const payload = Buffer.from(JSON.stringify(value));

  if (payload.length >= 65_536) {
    throw new Error("Status WebSocket payload is too large.");
  }

  const header = payload.length < 126
    ? Buffer.from([0x81, payload.length])
    : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff]);

  socket.write(Buffer.concat([header, payload]));
}

function respondToWebSocketPings(socket) {
  let pending = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    pending = Buffer.concat([pending, chunk]);

    while (pending.length >= 2) {
      const firstByte = pending[0];
      const secondByte = pending[1];
      const masked = (secondByte & 0x80) !== 0;
      let payloadLength = secondByte & 0x7f;
      let headerLength = 2;

      if (payloadLength === 126) {
        if (pending.length < 4) return;
        payloadLength = pending.readUInt16BE(2);
        headerLength = 4;
      } else if (payloadLength === 127) {
        socket.destroy();
        return;
      }

      const maskLength = masked ? 4 : 0;
      const frameLength = headerLength + maskLength + payloadLength;
      if (pending.length < frameLength) return;

      const mask = pending.subarray(headerLength, headerLength + maskLength);
      const payload = Buffer.from(pending.subarray(headerLength + maskLength, frameLength));
      pending = pending.subarray(frameLength);

      if (masked) {
        for (let index = 0; index < payload.length; index += 1) {
          payload[index] ^= mask[index % 4];
        }
      }

      const opcode = firstByte & 0x0f;
      if (opcode === 0x9 && payload.length <= 125) {
        socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
      }
    }
  });
}

async function resolveFile(pathname) {
  try {
    const decodedPath = decodeURIComponent(pathname);
    const requestedPath = path.resolve(staticDirectory, `.${decodedPath}`);

    if (!requestedPath.startsWith(`${staticDirectory}${path.sep}`) && requestedPath !== staticDirectory) {
      return null;
    }

    const requestedStats = await stat(requestedPath);
    if (requestedStats.isFile()) {
      return requestedPath;
    }
  } catch {
    // Fall through to the Angular SPA entry point.
  }

  return path.join(staticDirectory, "index.html");
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const filePath = await resolveFile(url.pathname);

  if (!filePath) {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
    "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable"
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
});

server.on("upgrade", (request, socket) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname !== "/status" || request.headers.upgrade?.toLowerCase() !== "websocket") {
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
  respondToWebSocketPings(socket);
  socket.on("error", () => {});
});

server.on("error", (error) => {
  console.error("Regismatic web server failed to start:", error);
  process.exitCode = 1;
});

server.listen(port, hostname, () => {
  console.info(`Regismatic web listening on port ${port}`);
});
