const { checkBoardState } = require('./board');
const { getRoomResponse, getRoom } = require('./rooms');
const { emitGameUpdate } = require('./socketBroadcaster');
const { makeAIMove } = require('./ai');
const amqp = require('amqplib/callback_api');

//credenciales
const RABBITMQ_USER = 'arquesoft-manager';
const RABBITMQ_PASSWORD = 'Ajua_Kuin29';
const RABBITMQ_HOST = 'localhost';
const RABBITMQ_URL = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}`;

//conexion con RabbitMQ
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
    if(channel){
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

module.exports = { move };