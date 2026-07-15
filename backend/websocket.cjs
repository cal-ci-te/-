const WebSocket = require('ws');

const clients = new Set();

function initWebSocket(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('🔗 WebSocket 客户端连接');
        clients.add(ws);
        ws.send(JSON.stringify({ type: 'welcome', message: '连接到 REVACHOL 后端' }));

        ws.on('close', () => {
            console.log('🔌 客户端断开');
            clients.delete(ws);
        });
    });

    return wss;
}

function broadcast(data) {
    const msg = JSON.stringify(data);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

module.exports = {
    initWebSocket,
    broadcast,
};