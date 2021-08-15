//server time
var net = require('net');
require('./packet.js');

const port = 7101;

net.createServer(function(socket){ //when client connects

    //console.log("socket connected");
    var c_inst = new require('./client.js');
    var thisClient = new c_inst();

    thisClient.socket = socket;
    thisClient.initiate();

    socket.on('error', thisClient.error);

    socket.on('end', thisClient.end);

    socket.on('data', thisClient.data);

}).listen(port);

console.log("Server running on port: " + port );

//server time

const sport = 7102;
const server = require('http').createServer();
const io = require('socket.io')(server);
io.set('origins', "http://gotad.io:*")
const version = "0.0.7";
var total = 0; //total amount of clients that session
var current = 0; //total amount of concurrent clients
var gameid = 0; //array index and total amount of games
var games = []; //game data array
var gamechunk = 0;

module.exports = { //from client.js
    addplayer: function() {
        current ++;
        console.log(current + " concurrent clients connected");
    },
    delplayer: function() {
        current --;
    },
    newGame: function(gcount, game) {
        gameid = gcount;
        games[gameid] = game; // gameid - 1 ???
        gamechunk = "";
        gameid ++;
        for (let i = 0; i < gameid; i++){
            gamechunk += games[i] + "&";
        }
    },
    updateGame: function(gid, game) {
        games[gid] = game;
        gamechunk = "";
        for (let i = 0; i < gameid; i++){
            gamechunk += games[i] + "&";
        }
    },
    delGame: function(gcount, gid) {
        gameid = gcount;
        games[gid] = 0;
        if (gid < gameid) { //condense
            let breaknum = (gid + 1);
            for (let c = breaknum; c < gameid; c++) {
                games[c - 1] = games[c]; //shrink list
                games[c] = 0;
            }
            gameid -= 1; //reduce game array index (total number of games)
        }
        gamechunk = "";
        for (let i = 0; i < gameid; i++){
            if (games[i] !== 0) {
                gamechunk += games[i] + "&";
            }
        }
    }
}

// Listen for incoming connections
server.listen(sport, (err) => {
    if (err) throw err;
    console.log("socket.io server running on port: " + sport );
});


io.on('connection', (client) => {

    total ++;
    current ++;
    let date = new Date();
    console.log("browser player connected; " + current + " concurrent players connected, " + total + " players connected so far " + date.getHours() + ":" + date.getMinutes());
    client.id = total;

    // Send clients SID
    client.emit('server_id', {
        server_id: version
    });


    //refresh gameslist
    client.on('refresh', (data) => {
        client.emit('games', gamechunk);
    });


    client.on('disconnect', (data) => {
        current --;
        delete client;
        //console.log("browser client " + client.id + " closed");
    });

});
