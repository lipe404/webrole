const WebSocket = require("ws");

// Usa a porta fornecida pela Render, ou 3000 localmente
const PORT = process.env.PORT || 3000;

const wss = new WebSocket.Server({ port: PORT });

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });
});

console.log(`Servidor WebSocket rodando na porta ${PORT}`);
