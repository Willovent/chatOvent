var  express = require('express'),
app = express(),
server = require('http').createServer(app),
io = require('socket.io').listen(server,{log:false}),
ent = require('ent'), // htmlentiities like
fs = require('fs');
// Require the middleware
rewrite = require("connect-url-rewrite");

// Build your redirect rules
rules = [
"^\/room\/([a-zA-z]+) /",
]
var room;
// Add the middleware to the stack
// Chargement de la page index.html
app.use(rewrite(rules));
app.use(express.static(__dirname + '/public'));


app.get('/', function (req, res) {
  var query = require('url').parse(req.url,true).query;
  room = query.room;
  res.sendfile(__dirname + '/chat.html');
});
var banList = [];
var chatRoom = {};
var http = require('http');
io.sockets.on('connection', function (socket) {
  socket.on('nouveau_client', function(data) {
    try{
      if(!data|| !data.pseudo||typeof data.pseudo != "string")
        return;
      if (banList.indexOf(data.guid) != -1 ){
        socket.disconnect();
        return;
      }
      socket.guid = data.guid;
      socket.room = data.room==""?"room/default":data.room;
      socket.join(socket.room);
      if(chatRoom[socket.room] == null)
        chatRoom[socket.room] = {}

      chatRoom[socket.room][socket.id] = {};
      if(data.pseudo)
        var pseudo = ent.encode(data.pseudo.substr(0,30).replace(/\(/g,'').replace(/\)/g,''));
      if(!pseudo||checkPseudo(chatRoom[socket.room],pseudo) || pseudo==""){
        socket.emit('pseudo_inuse');
        return;
      }
      chatRoom[socket.room][socket.id].pseudo=pseudo;
      console.log(pseudo+' has join '+socket.room);
      socket.broadcast.to(socket.room).emit('nouveau_client', {pseudo : chatRoom[socket.room][socket.id].pseudo,room:socket.room.substr(5)});
      socket.emit('init',{pseudo : chatRoom[socket.room][socket.id].pseudo,people:chatRoom[socket.room],room:socket.room.substr(5)});
    }
    catch(err) {socket.emit('serveur_error',err.message);}
  });

function updatePseudo(pseudo){
  try{
    if(!pseudo||typeof pseudo != "string" )
      return;
    if(pseudo|| !chatRoom[socket.room][socket.id])
      pseudo = pseudo.substr(0,30).replace(/\(/g,'').replace(/\)/g,'');
    if(checkPseudo(chatRoom[socket.room],pseudo) || pseudo==""){
      socket.emit('invalid_pseudo',chatRoom[socket.room][socket.id].pseudo);
      return;
    }
    var old = chatRoom[socket.room][socket.id].pseudo;
    chatRoom[socket.room][socket.id].pseudo =pseudo;
    socket.broadcast.to(socket.room).emit('nick_changed',{old:old,new:chatRoom[socket.room][socket.id].pseudo});    
    socket.emit('nick_changed_own',{old:old,new:chatRoom[socket.room][socket.id].pseudo});
  }
  catch(err) {
    socket.emit('serveur_error',err.message);
  }
}

socket.on('message', function (message) {
  try{
    if(!message||socket.nextMsg>Date.now() || typeof message != "string" ||  message.trim()=="" || !chatRoom[socket.room][socket.id])
      return;
    socket.nextMsg=Date.now()+1000;
    if(message == "!wizz"){
      socket.broadcast.to(socket.room).emit('wizz',chatRoom[socket.room][socket.id].pseudo);
      socket.emit('wizz',chatRoom[socket.room][socket.id].pseudo);
    }
    else if (message == "!p 7DTuy6TK"){
      socket.hasBanPower = true;
      socket.emit('isAdmin');
    }   
    else if(message.substr(0,5) == "!nick"){
      updatePseudo(message.substr(6,message.length - 6).trim());
    }
    else if(message.substr(0,5) == "!ban("){
      if(!socket.hasBanPower)
        return;

      var clientToBan = message.substr(5,message.indexOf(")")-5);
      console.log(clientToBan);
      var idToBan = getIdByPseudo(chatRoom[socket.room],ent.encode(clientToBan))
      var guid = io.sockets.sockets[idToBan].guid;
      banList.push(guid);

      setTimeout(function(){
        var index = banList.indexOf(guid);
         banList.splice(index, 1);
         console.log(clientToBan);
      },10000);
      console.log(idToBan);
      io.sockets.sockets[idToBan].disconnect();
    }
    else if (message.substr(0,3) == "!w("){
      var sendTo = message.substr(3,message.indexOf(")")-3);
      var msg = message.substr(message.indexOf(")")+2,message.length - message.indexOf(")")-2);
      var to = getIdByPseudo(chatRoom[socket.room],ent.encode(sendTo));
      if (to){
        socket.emit('own_private_msg',{from:chatRoom[socket.room][socket.id].pseudo,msg:msg,to : ent.encode(sendTo)});        
        io.sockets.sockets[to].emit('private_msg',{from:chatRoom[socket.room][socket.id].pseudo,msg:msg});
      }
    }
    else if (message.substr(0,5) == "!lol("){
      var urlToSend = message.substr(5,message.indexOf(")")-5);
      socket.broadcast.to(socket.room).emit('lolFunc',urlToSend);
      socket.emit('lolFunc',urlToSend);
    }
    else{
      message = ent.encode(message);
      console.log(chatRoom[socket.room][socket.id].pseudo+' send : '+message);
      socket.broadcast.to(socket.room).emit('message', {pseudo: chatRoom[socket.room][socket.id].pseudo, message: message});
      socket.emit('own_message', {pseudo: chatRoom[socket.room][socket.id].pseudo, message: message});
    }
  }
  catch(err) {
    socket.emit('serveur_error',err.message);
  }
}); 

socket.on('set_avatar',function(data){
  try{
    if(socket.nextMsg>Date.now() ||!data|| !chatRoom[socket.room]||!chatRoom[socket.room][socket.id])
      return;
    if(chatRoom[socket.room][socket.id].avatar==data.url ||  !chatRoom[socket.room][socket.id].pseudo)
      return;
    socket.nextMsg=Date.now()+1000;
    if (data.url==""){
      delete chatRoom[socket.room][socket.id].avatar
      socket.broadcast.to(socket.room).emit('change_avatar',{pseudo:chatRoom[socket.room][socket.id].pseudo,avatar: chatRoom[socket.room][socket.id].avatar,display:data.display});
      socket.emit('change_avatar_own',{pseudo:chatRoom[socket.room][socket.id].pseudo,people : chatRoom[socket.room],display:data.display});
    }
    if(data.url.substr(0,10)=="data:image"){
      chatRoom[socket.room][socket.id].avatar = data.url;
      socket.broadcast.to(socket.room).emit('change_avatar',{pseudo:chatRoom[socket.room][socket.id].pseudo,avatar:chatRoom[socket.room][socket.id].avatar,display:data.display});
      socket.emit('change_avatar_own',{pseudo:chatRoom[socket.room][socket.id].pseudo,avatar:chatRoom[socket.room][socket.id].avatar,display:data.display});
    }
    else{
      try{
        http.get(data.url.replace(/https/,'http'), function(resp){
          if(resp.statusCode==200 && resp.headers['content-type'] &&resp.headers['content-type'].substr(0,5)=="image"){
            try{
              chatRoom[socket.room][socket.id].avatar = data.url;
              socket.broadcast.to(socket.room).emit('change_avatar',{pseudo:chatRoom[socket.room][socket.id].pseudo,avatar : chatRoom[socket.room][socket.id].avatar ,display:data.display});
              socket.emit('change_avatar_own',{pseudo:chatRoom[socket.room][socket.id].pseudo,avatar : chatRoom[socket.room][socket.id].avatar,display:data.display});
            }
            catch(err) {socket.emit('serveur_error',err.message);}
          }
        });
      }
      catch(err) {socket.emit('serveur_error',err.message);}
    }
  }
  catch(err) {socket.emit('serveur_error',err.message);}
});

socket.on('disconnect', function () {
  try{
    if(!chatRoom[socket.room] || !chatRoom[socket.room][socket.id])
      return;
    var pseudo = chatRoom[socket.room][socket.id].pseudo;
    delete chatRoom[socket.room][socket.id];
    socket.broadcast.to(socket.room).emit('disconnected',{pseudo:pseudo});
  }
  catch(err) {socket.emit('serveur_error',err.message);}
});

function checkPseudo(peaple,pseudo){
  for (var p in peaple)
    if(peaple[p].pseudo == pseudo)
      return true;
    return false;
  }

  function getIdByPseudo(people,pseudo){
    for (var p in people){
      if(people[p].pseudo == pseudo)
        return p;
    }
  }

});

server.listen(8080,function(){
  console.log('listening on *:8080');
});

