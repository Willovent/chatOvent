var socket = io.connect("/");
var window_focus = true;
var isAdmin = false;
var wizzSound = new Audio("/nudge.mp3");
moment.locale('fr');

var guid = (function() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000)
		.toString(16)
		.substring(1);
	}
	return function() {
		return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
		s4() + '-' + s4() + s4() + s4();
	};
})();
if(!localStorage['guid']){
	localStorage['guid'] = guid();
}

$.contextMenu({
	selector : 'strong',
	build: function(){
		var i = isAdmin? {
			"ban": {name: "Bannir"},
			"wisp": {name: "Chuchoter"},
		} : {
			"wisp": {name: "Chuchoter"},
		}
		return {
			callback: function(key, options) {
				switch(key){
					case "ban":
					socket.emit('message', '!ban('+$(this).find('p')[0].innerHTML+')');
					break;
					case"wisp":
					$('#message').val('!w(' +$(this).find('p')[0].innerHTML + ') ').focus();
					break;
				}
			},
			items: i
		};
	}
});
setInterval(function(){
	$('.time').each(function(i,e){
		e.innerText = moment(e.getAttribute('time')).fromNow() //pas de jquery pour opti les perfs, déjà que c'est un $.each avec un constructeur de moment dedans :)
});
},1000)

function ChatViewModel(){
	var that = this;
	this.messages = ko.observableArray([]);
	this.showMessage = function(elem) { if (elem.nodeType === 1) $(elem).hide().fadeIn().find('.bubble').emoticonize(); }
	this.hideMessage = function(elem) { if (elem.nodeType === 1) $(elem).fadeOut(function() { $(elem).remove(); }) }
}
var chatViewModel = new ChatViewModel();
ko.applyBindings(chatViewModel,$('#zone-chat')[0]);


var pseudo = localStorage['pseudo']
if (!pseudo) {
	pseudo = prompt('Quel est votre pseudo ?') + "";
	localStorage['pseudo'] = pseudo;
}
socket.emit('nouveau_client', {room: location.pathname.substr(1, location.pathname.length - 1),pseudo: pseudo,guid : localStorage['guid'] });

document.title = pseudo + ' - Chatovent';
var avatar = localStorage['avatar'];
if (avatar)
	changeAvatar(avatar, false);

socket.on('message', function(data) {
	insereMessage(data.pseudo, data.message )
});
socket.on('own_message',function(data){
	insereMessage(data.pseudo, data.message,false , true);
})
socket.on('isAdmin',function(){
	isAdmin = true;
	consoleMessage('Vous disposez maintenant des droits d\'administrateur');
})

socket.on('lolFunc', function(url) {
	explodeImg(url);
});

socket.on('pseudo_inuse', function() {
	var pseudo = prompt('Ce pseudo est déjà utilisé') + "";
	localStorage['pseudo']= pseudo;
	socket.emit('nouveau_client', {room: location.pathname.substr(1, location.pathname.length - 1),pseudo: pseudo});
	document.title = pseudo + ' - Chatovent';
});

socket.on('serveur_error', function(err) {
	consoleMessage(err + '. Merci de communiquer cette erreur avec l\'administrateur');
});

socket.on('init', function(data) {
	//consoleMessage(data.pseudo + ' a rejoint le salon ' + data.room);
	populateConnectedList(data.people);
});

socket.on('nouveau_client', function(data) {
	var pseudo = htmlToText(data.pseudo);
	consoleMessage(data.pseudo + ' a rejoint le salon ' + data.room);
	var strong = $('<strong>').append($('<p>').append(data.pseudo).prop('title', pseudo));
	$('#pseudo').append(strong);	
	strong.attr('pseudo',pseudo);
	strong.find('p').attr('pseudo', pseudo).click(function() {
		$('#message').val('!w(' + $(this).attr('pseudo') + ') ').focus();
	});	
});

socket.on('nick_changed', function(data) { 
	consoleMessage( data.old + ' est maintenant connu comme étant ' + data.new);
	$('strong[pseudo="'+htmlToText(data.old)+'"]').attr('pseudo', htmlToText(data.new)).find("p").html( data.new).attr('pseudo', htmlToText(data.new));	
});

socket.on('nick_changed_own', function(data) {
	consoleMessage( data.old + ' est maintenant connu comme étant ' + data.new);
	$('strong[pseudo="'+htmlToText(data.old)+'"]').attr('pseudo', htmlToText(data.new)).find("p").html( data.new).attr('pseudo', htmlToText(data.new));
	localStorage['pseudo'] = data.new;
});

socket.on('change_avatar', function(data) {
	avatarUpdate(data.pseudo,data.avatar,data.display);
});

socket.on('change_avatar_own', function(data) {
	avatarUpdate(data.pseudo,data.avatar,data.display);	
	$('#loader-overlay').hide();
});

socket.on('disconnected', function(data) {
	consoleMessage(data.pseudo + ' a quitté le Chat');
	$('#pseudo strong[pseudo="'+htmlToText(data.pseudo)+'"]').remove();
});

socket.on('invalid_pseudo', function(pseudo) {
	consoleMessage('Votre pseudo n\'a pas changé, il est certainement déjà utilisé ou invalide');
	localStorage['pseudo']= pseudo;
});

socket.on('wizz', function(pseudo) {
	consoleMessage(pseudo + ' vous a envoyé un Wizz');
	wizzSound.play();
	$("#main-wrapper").animate({left: "+=5px"}, 40).animate({top: "+=5px"}, 40)
	.animate({top: "-=10px"}, 40).animate({left: "-=10px"}, 40)
	.animate({top: "+=5px"}, 40).animate({left: "+=5px"}, 40)
	.animate({left: "+=5px"}, 40).animate({top: "+=5px"}, 40)
	.animate({top: "-=10px"}, 40).animate({left: "-=10px"}, 40)
	.animate({top: "+=5px"}, 40).animate({left: "+=5px"}, 40);
});

socket.on('private_msg', function(data) {
	insereMessage(data.from, data.msg, true)
});
socket.on('own_private_msg',function(data){
	insereMessage(data.from, data.msg, true,true,data.to)
})
socket.on('disconnect', function() {
	consoleMessage('Vous avez été éjecté du serveur')
});

var window_focus = true;
$(window).focus(function() {
	window_focus = true;
})
.blur(function() {
	window_focus = false;
});
var msgStack = [];
var msgUnStack = [];
var currentStack;
$('#message').on('keydown', function(e) {
	if (e.which == 38) 
	{
		if (msgStack.length > 0) {
			if (currentStack)
				msgUnStack.push(currentStack)
			currentStack = msgStack.pop()
			$('#message').val(currentStack);
		}
	} 
	else if (e.which == 40) {
		if (msgUnStack.length > 0) 
		{
			if (currentStack)
				msgStack.push(currentStack)
			currentStack = msgUnStack.pop()
			$('#message').val(currentStack);
		} 
		else if ($('#message').val() != "")
			$('#message').val('')
	}
});
$('#formulaire_chat').submit(function() {
	try{
		if(Notification){
			if (Notification.permission !== 'denied') {
				Notification.requestPermission(function(permission) {
					if (!('permission' in Notification)) {
						Notification.permission = permission;
					}
				});
			}
		}
	}
	catch(e)
	{
		console.log('pas de notifs')
	}
	var message = $('#message').val();
	currentStack = "";
	msgStack.push(message);
	socket.emit('message', message);
	$('#message').val('').focus();
	return false;
});

function changeAvatar(url, display) {
	if(!display){
		var load = $('#own-avatar')[0].onload;
		$('#own-avatar')[0].onload = null;
		$('#own-avatar')[0].src = url;
		$('#own-avatar')[0].onload = load;
	}
	localStorage['avatar'] = url;
	socket.emit('set_avatar', {url: url,display: display});
	$('#loader-overlay').show();
}

function insereMessage(pseudo, message, isPrivate, isOwn, to) {
	var avatar = $('#pseudo strong[pseudo="'+htmlToText(pseudo)+'"]')
	.css('background-image');
	if(avatar)
		avatar = avatar.replace("url('","")
				.replace("url(","")
					.replace("')","")
					.replace(")","");
	var mess = {
		text : message.replace(/&NewLine;/g,'<br />'),
		pseudo : $('<div>').html(pseudo).text(),
		avatar : avatar ? avatar :"/default_avatar.png",
		isOwn : isOwn ? true : false,    //avoid undefined mageule
		time : moment()._d,
		isPrivate : isPrivate ? true : false,
		to: to?'à '+htmlToText(to): '',
	} 
	if (window.Notification && Notification.permission === "granted" && !window_focus) {
		var n = new Notification("Nouveau message de "+mess.pseudo,{
			icon : mess.avatar,
			body : $('<div>').html(mess.text).text().substring(0,80)
		});
		n.onshow = function () { 
			setTimeout(n.close.bind(n), 5000); 
		}
	}
	chatViewModel.messages.push(mess)
	//chrome
	$('body').stop().animate({
		scrollTop: $("body")[0].scrollHeight
	}, 1000);
	//ie ff
	$('html').stop().animate({
		scrollTop: $("body")[0].scrollHeight
	}, 1000);
}
function populateConnectedList(people) {
	$('#pseudo').html("");
	for (var p in people) {
		var pseudo = $('<div>').html(people[p].pseudo).text()
		var strong = $('<strong>').append($('<p>').append(people[p].pseudo).prop('title', pseudo));
		if (people[p].avatar != null) {
			strong.css('background', 'url(' + people[p].avatar + ')');
		}
		$('#pseudo').append(strong);	
		strong.attr('pseudo',pseudo);
		strong.find('p').attr('pseudo', pseudo).click(function() {
			$('#message').val('!w(' + $(this).attr('pseudo') + ') ').focus();
		});	
	}
	
}

function consoleMessage(message){
	var msg = $('<li>').append($('<em>').text($('<div>').html(message).text())).addClass('info');
	$('#zone-chat').append(msg);
	msg.fadeIn();
	setTimeout(function(){msg.fadeOut('slow',function(){$(this).remove()});},3000)
}

function explodeImg(url) {
	var inter = setInterval(function() {
		for (var i = 0; i < 20; i++)
			$('body')
		.append($('<img>')

			.css({
				width: Math.random() * 200 + 'px',
				position: 'fixed',
				left: Math.random() * window.innerWidth + 'px',
				top: Math.random() * window.innerHeight + 'px'
			}).prop('src', url)
			.animate({
				left: "+=" + (Math.random() * window.innerWidth - window.innerWidth / 2) + "px",
				top: "+=" + (Math.random() * window.innerHeight - window.innerHeight / 2) + "px"
			}, 1000, 'linear').fadeOut(50, function() {
				$(this).remove()
			}))
	}, 100);
	setTimeout(function() {
		clearInterval(inter)
	}, 1000);

}
$(function(){
	window.scrollTo(0,1);
	$('#pseudo-contener').click(function(){
		if($(window).width()<992)
			$(this).toggleClass('animate')
	}
	);
	$('#overlay').fadeOut(500,function(){
		$('footer,aside').css({zIndex : 1});
	});
	var img = $('#own-avatar')[0];

	img.onload = function() { 
		var width = 80;
		var height = 80;
		if(this.naturalWidth > this.naturalHeight ) {
			width = this.naturalWidth/this.naturalHeight*80;
		}
		else{
			height = this.naturalHeight/this.naturalWidth*80;
		}
		this.height = height;
		this.width = width;
		changeAvatar(this.src, true)
	};

	img.onerror = function(){
		alert('Ceci n\'est pas une image !');
		img.src = "/default_avatar.png";
		this.height = 80;
		this.width = 80;
	}
	$('#change_avatar').click(function(){
		$('#avatar-overlay').fadeIn();
	});

	$('#avatar-overlay').click(function(){
		$(this).fadeOut();
	});

	$("#avatar-overlay *").click(function(e) {
		e.stopPropagation();
	});

	$('#file-avatar').change(function(){
		var file = this.files[0];
		if(file.size>500*1024){
			alert('Veulliez selectioner une image d\'taille inférieur à 500ko.')
			return;
		}

		getBase64(file,function(url){
			img.src=url;
		});
	});

	$('#url-avatar').change(function(){
		img.src=this.value;
	})
})

$('textarea').keyup(function (event) {
	if (event.keyCode == 13 && event.shiftKey) {

	}else if(event.keyCode == 13)
	{		
		this.value = this.value.slice(0, this.selectionStart -1) + this.value.slice(this.selectionStart);
		$('form').submit();
	}

});



function getBase64(file,callback){

	var reader = new FileReader();
	reader.onload = function(readerEvt) {
		var base64 = readerEvt.target.result;
		callback(base64);
	}
	reader.readAsDataURL(file);
}

var guid = (function() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000)
		.toString(16)
		.substring(1);
	}
	return function() {
		return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
		s4() + '-' + s4() + s4() + s4();
	};
})();

function htmlToText(html){
	return $('<div>').html(html).text();
}

function avatarUpdate(pseudo,avatar,display){
	if (display)
		consoleMessage(pseudo + ' a changé d\'avatar');
	$('strong[pseudo="'+htmlToText(pseudo)+'"]').css('background-image','url('+avatar+')')	
}