const http = require('http');
const express = require('express');
const { initializeSocket } = require('./socketInitializer');
const { setupSocketHandlers } = require('./socketHandler');
const path = require('path');
const amqp = require('amqplib/callback_api');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const port = 8000;
const server = http.createServer(app);
const io = initializeSocket(server);

//conexion a rabbit
let canal = null;
amqp.connect('amqp://localhost', function(error0, connection) {
    if (error0){
        throw error0;
    }
    connection.createChannel(function(error1, ch) {
        if(error1){
            throw error1;
        }
        canal = ch;
        canal.assertQueue('game_events', {
            durable: false
        });
    });
});

function publicarevento(event){
    if(canal){
        canal.sendToQueue('game_events', Buffer.from(JSON.stringify(event)));
    }
}

function move(socket, cell) {
    let roomId = socket.roomId;
    if (!roomId) return;
    let room = getRoom(roomId);
    if (!room) return;

    let currentPlayerSocket = room.player1.side === room.currentPlayer 
        ? room.player1.socket
        : room.player2.socket;

    if (currentPlayerSocket !== socket) return;
    if (room.board[cell] !== '') return;

    makeMove(roomId, room, cell);
    if (room.mode === 'vsAI') {
        let aiCell = makeAIMove(room, room.player2.socket.difficulty);
        setTimeout(() => {
            makeMove(roomId, room, aiCell);
        }, 500);
    }
}

function makeMove(roomId, room, cell) {
    room.board[cell] = room.currentPlayer;
    room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';

    checkBoardState(roomId, room);
    emitGameUpdate(roomId, getRoomResponse(room));

    //publicaremos el evento del juego
    publicarevento({
        type: 'move',
        gameId: roomId,
        player: room.currentPlayer === 'X' ? 'O' : 'X',
        cell: cell,
        board: room.board
    });
}

setupSocketHandlers(io);

server.listen(port, function() {
    console.log(`Server is listening on port: ${port}`);
});