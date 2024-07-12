const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const amqp = require('amqplib/callback_api');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

//websoket para espectadores
io.on('connection', (socket) => {
    console.log('Espectador conectado');

    socket.on('spectatorRoom', (roomId) => {
        socket.join(roomId);
        console.log(`Espectador se unio en el room ${roomId}`);
    });
});

//conexion a Rabbit y eventos del juego
amqp.connect('amqplib://localhost', function(error0,conexion) {
    if(error0){
        throw error0;
    }
    conexion.createChannel(function(error1, canal) {
        if (error1) {
            throw error1;
        }
        const queue = 'game_events';
        canal.assertQueue(queue, {
            durable: false
        });
        canal.consume(queue, function(msg) {
            const event = JSON.parse(msg.content.toString());
            console.log('Evento recibido: ' , event);

            //transmitir evento a todos los espectadores
            io.to(event.gameId).emit('game_event', event);
        }, {
            noAck: true
        });
    });
});

//Servidor en el puerto 3001
server.listen(3001, () => {
    console.log('Espectador en puerto 3001');
});