//client.js
var total = 0; //total amount of clients that session
var current = 0; //total amount of concurrent clients
var hostnum = 0; //total amount of hosts (total was getting too high to use as client.id in arrays)
const version = "0.3.4";
var games = [];
var gameid = 0; //array index and total gamecount
var breaknum; //for deleting client servers
var idindex; //same^
var cleartimer = []; //game phase out timer


require('./packet.js');
var serv = require('./server.js');

var tcpPortUsed = require('tcp-port-used');

function phaseOut(cip,hostnum) {
    //find & delete
    for (let i = 0; i < gameid; i++) { //check to see if they were hosting a server
        idindex = (games[i].indexOf("IP") + 6); //see where "ID" is at, add 6 to get over quotation marks and spaces and shit
        let idend = games[i].lastIndexOf('"');
        idindex = games[i].substring(idindex, idend); //take "ID"'s location and keep reading for how long the client.id is
        if (idindex === cip) { //if the acquired string "a number" is equal to the client.id
            games[i] = 0; //blank it
            serv.delGame(gameid, i);
            breaknum = (i + 1); //one above the break value
            console.log("game[" + i + "] deleted");
            clearTimeout(cleartimer[hostnum]);
            cleartimer[hostnum] = 0; //blanked!
            if (i < gameid) { //condense
                for (let c = breaknum; c < gameid; c++) {
                    games[c - 1] = games[c]; //shrink list
                    games[c] = 0;
                }
            }
            gameid--; //reduce game array index (total number of games)
            break;
        }
    }
}

module.exports = function() {
    var client = this;

    this.initiate = function() {
        //send the handshake packet
        current ++;
        total ++;
        serv.addplayer();
        client.id = total.toString();
        let isFull = 0;
        if (gameid > 49) isFull = 1;
        client.socket.write(packet.build([0,version,isFull]));
        console.log("client player connected; " + current + " concurrent players connected, " + total + " clients players so far");
        client.host = false;
    }

    this.data = function(data) {
        data = data.toString();
        var mode = data.slice(0,1); //get rid of invisible character
        if (mode === "0"){ //client request game info
            console.log("sending gameslist to client " + client.id + "...");
            let gamechunk = 0;
            for (let i = 0; i < gameid; i++){
                if (games[i] !== 0){
                    gamechunk += games[i];
                }
            }
            client.socket.write(packet.build([1,gameid.toString(),gamechunk.toString()])); //sync
        }
        else if (mode === "1") { //receive game data from new client game
            let vsn = data.includes(version.toString());
            if ((vsn === true) && (gameid < 50)){ //50 cap right now
                idindex = (data.indexOf("IP") + 6); //see where "IP" is at, add 6 to get over quotation marks and spaces and shit
                let idend = data.lastIndexOf('"');
                idindex = data.substring(idindex, idend); //take "IP"'s location and keep reading for how long it continued before '"'
                client.ip = idindex;
                //tcpPortUsed.check(7100, client.ip)
                //.then(function(inUse) {
                // console.log('Port 7100 for client ' + client.id + ' in use: ' + inUse);
                // if (inUse === true){
                data = data.slice(8, data.length); //get rid of invisible character, mode number (0), '_', and version
                games[gameid] = data;
                console.log("game[" + gameid + "] from client " + client.id + ": " + games[gameid]);
                client.host = true;
                //#region find host num
                let nohostnum = true;
                for (let i = 0; i < hostnum; i++){
                    if (cleartimer[i] == 0){ //if it's blank
                        client.hostnum = i;
                        nohostnum = false;
                        break;
                    }
                }
                if (nohostnum === true) {
                    client.hostnum = hostnum; //host number
                    hostnum++;
                }
                //#endregion
                clearTimeout(cleartimer[client.hostnum]);
                cleartimer[client.hostnum] = setTimeout(phaseOut, 62000, client.ip, client.hostnum);
                serv.newGame(gameid, games[gameid]);
                gameid++;
                //}
                //    else{ //port not in use (not forwarded)
                //        requestStop();
                //    }
                //  }, function(err) {
                //     console.log('Timeoout on check for ' + client.id + ': , err.message');
                //     requestStop();
                //  });
            }
            else if (((vsn === false) && (gameid < 50)) || ((vsn === false) && (gameid >= 50))){
                requestStop();
                console.log("received outdated game data from " + client.id);
            }
            else if ((vsn === true) && (gameid >= 50)){
                requestStop();
                console.log("couldn't create server for " + client.id + ", server list full");
            }
            else{
                requestStop();
                console.log("couldn't create server for " + client.id);
            }
        }
        else if (mode === "2") { //update game data
            let vsn = data.includes(version.toString());
            if (vsn === true) {
                //#region find & update game
                data = data.slice(8, data.length); //get rid of invisible character, mode number (0), '_', and version
                for (let i = 0; i < gameid; i++) { //check to see if they were hosting a server
                    idindex = (games[i].indexOf("IP") + 6); //see where "IP" is at, add 6 to get over quotation marks and spaces and shit
                    let idend = games[i].lastIndexOf('"');
                    idindex = games[i].substring(idindex, idend); //take "IP"'s location and keep reading for how long it continued before '"'
                    if (idindex === client.ip) { //if the acquired string "a number" is equal to the client.iddddd
                        games[i] = data;
                        //console.log("updated game for " + client.ip);
                        serv.updateGame(i, games[i]);
                        clearTimeout(cleartimer[client.hostnum]);
                        cleartimer[client.hostnum] = setTimeout(phaseOut, 62000, client.ip, client.hostnum);
                        break;
                    }
                }
            }
            else{
                requestStop();
                console.log("received outdated game data from " + client.id);
            }
            //#endregion
        }
        else{
            //do nothing
        }

        function requestStop() {
            client.socket.write(packet.build([3]));
        }

    }

    this.error = function(err) {
        current --;
        if (client.host === true) {
            phaseOut(client.ip,client.hostnum);
        }
        serv.delplayer();
        console.log("client " + client.id + " error " + err.toString());
        delete client;
    } //basically identical to end event below

    this.end = function(){
        current --;
        //delete game
        if (client.host === true) { //he was host
            phaseOut(client.ip,client.hostnum);
        }
        serv.delplayer();
        console.log("client " + client.id + " closed");
        delete client;
    }

}