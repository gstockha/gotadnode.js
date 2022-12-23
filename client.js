//client.js
let total = 0; //total amount of clients that session
let current = 0; //total amount of concurrent clients
let hostnum = 0; //total amount of hosts (total was getting too high to use as client.id in arrays)
const version = "1.1.9";
let games = [];
let gameid = 0; //array index and total gamecount
let breaknum; //for deleting client servers
let idindex; //same^
let cleartimer = []; //game phase out timer


require('./packet.js');
let serv = require('./server.js');
let tcpPortUsed = require('tcp-port-used');

//#region unscramble
let scramble = {"Q": "1", "A": "2", "Z": "3", "R": "4", "F": "5", "V": "6", "Y": "7", "H": "8", "N": "9", "O": "0", "P": "."};
function unscramble(cip) {
    let nucip = "";
    let ciplength = cip.length;
    let slice = "";
    for (let i = ciplength; i > 0; i--){
        slice = cip.slice(i-1,i);
        if (!scramble[slice]) return "";
        nucip += scramble[slice];
    }
    console.log(nucip);
    return nucip;
}
//#endregion

function phaseOut(cip,hostnum) {
    //find & delete
    for (let i = 0; i < gameid; i++) { //check to see if they were hosting a server
        idindex = games[i]["IP"];
        if (idindex === cip) { //if the acquired string "a number" is equal to the client.id
            games[i] = 0; //blank it
            serv.delGame(gameid, i);
            breaknum = (i + 1); //one above the break value
            console.log("game[" + i + "] deleted");
            clearTimeout(cleartimer[hostnum]);
            cleartimer[hostnum] = 0; //blanked!
            //if (i < gameid) { //condense
            games.splice(i,1);
            //    for (let c = breaknum; c < gameid; c++) {
            //        games[c - 1] = games[c]; //shrink list
            //        games[c] = 0;
            //    }
            //}
            gameid -= 1; //reduce game array index (total number of games)
            break;
        }
    }
}

module.exports = function() {
    let client = this;

    this.initiate = function() {
        //send the handshake packet
        current ++;
        total ++;
        serv.addplayer();
        client.id = total.toString();
        let isFull = 0;
        if (gameid > 49) isFull = 1;
        client.socket.write(packet.build([0,version,isFull]));
        let date = new Date();
        console.log("client player connected; " + current + " concurrent players connected, " + total + " clients players so far " + date.getHours() + ":" + date.getMinutes());
        client.host = false;
    }

    this.data = function(data) {
        data = data.toString();
        let mode = data.slice(0,1); //get rid of invisible character
        if (mode === "0"){ //client request game info
            console.log("sending gameslist to client " + client.id + "...");
            let gamechunk = "";
            let game = "";
            for (let i = 0; i < gameid; i++){
                if (games[i] !== 0){
                    game = JSON.stringify(games[i]);
                    gamechunk += (game + "&");
                }
            }
            client.socket.write(packet.build([1,gameid.toString(),gamechunk.toString()])); //sync
        }
        else if (mode === "1") { //receive game data from new client game
            let vsn = data.includes(version.toString());
            data = data.slice(8, data.length); //get rid of invisible character, mode number (0), '_', and version
            data = data.replace(/\0/g, '');
            data = JSON.parse(data);
            client.ip = data["IP"];
            let IPget = 0;
            let dupeIP = false;
            let validIP = true;
            for (let c = 0; c < gameid; c++){
                IPget = games[c]["IP"];
                if (client.ip === IPget){
                    dupeIP = true;
                    break;
                }
            }
            //make a regex that checks for a valid ipv4 address
            let nucip = unscramble(client.ip);
            let ipregex = new RegExp("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$");
            if (ipregex.test(nucip) === false) validIP = false;
            if ((vsn === true) && (gameid < 50) && (dupeIP === false) && (validIP === true)){ //50 cap right now
                tcpPortUsed.waitUntilUsedOnHost(7100, nucip, 10000, 15000)
                    //.then(function(inUse) {
                    .then(function() {
                      //  if (inUse === true) {
                            games[gameid] = data;
                            let date = new Date();
                            console.log("game[" + gameid + "] from client " + client.id + ": " + JSON.stringify(games[gameid]) + " " + date.getHours() + ":" + date.getMinutes());
                            client.host = true;
                            //#region find host num
                            let nohostnum = true;
                            for (let i = 0; i < hostnum; i++) {
                                if (cleartimer[i] == 0) { //if it's blank
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
                            serv.newGame(gameid, JSON.stringify(games[gameid]));
                            gameid++;
                       // }
                       // else{ //port not in use (not forwarded)
                       //     requestStop();
                       // }
                      }, function(err) {
                         console.log('Timeoout on check for ' + client.id + ': , err.message');
                         requestStop();
                    });
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
                data = data.replace(/\0/g, '');
                data = JSON.parse(data);
                for (let i = 0; i < gameid; i++) { //check to see if they were hosting a server
                    idindex = games[i]["IP"];
                    if (idindex === client.ip) {
                        games[i] = data;
                        serv.updateGame(i, JSON.stringify(games[i]));
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
        err = err.toString();
        if (err !== "Error: This socket has been ended by the other party"){ current --;}
        if (client.host === true) {
            phaseOut(client.ip,client.hostnum);
        }
        serv.delplayer();
        console.log("client " + client.id + " disconnected");
        delete client;
    } //basically identical to end event below

    this.end = function(){
        //current --;
        //delete game
        if (client.host === true) { //he was host
            phaseOut(client.ip,client.hostnum);
        }
        serv.delplayer();
        let date = new Date();
        console.log("client " + client.id + " closed " + date.getHours() + ":" + date.getMinutes());
        delete client;
    }

}
