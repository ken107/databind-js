
function Messenger(elem) {
	this.users = null;
	this.session = null;
	var ws;
	this.connect = function() {
		if (ws) ws.close();
		ws = new (WebSocket || MozWebSocket)(this.connectUrl);
		ws.onopen = (function() {
			this.action("signIn", [this.myUserInfo]);
			ws.send(JSON.stringify({cmd: "SUB", pointers: ["/users", "/session"]}));
		}).bind(this);
		ws.onmessage = (function(e) {
			var m = JSON.parse(e.data);
			if (m.cmd == "PUB") jsonpatch.apply(this, m.patches);
		}).bind(this);
	};
	this.action = function(method, args) {
		ws.send(JSON.stringify({cmd: "ACT", method: method, args: args}));
	};
}

function UserList(elem) {
}

function ChatBox(elem) {
	this.formatTime = function(time) {
		var when = new Date(time);
		var result = formatAMPM(when);
		var now = new Date();
		if (now.getFullYear() != when.getFullYear() || now.getMonth() != when.getMonth() || now.getDate() != when.getDate())
			result = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][when.getMonth()] + " " + when.getDate() + ", " + when.getFullYear() + " " + result;
		return result;
	}
	function formatAMPM(date) {
	  var hours = date.getHours();
	  var minutes = date.getMinutes();
	  var ampm = hours >= 12 ? 'pm' : 'am';
	  hours = hours % 12;
	  hours = hours ? hours : 12;
	  minutes = minutes < 10 ? '0'+minutes : minutes;
	  var strTime = hours + ':' + minutes + ' ' + ampm;
	  return strTime;
	}
}

function Dragger(elem, onComplete) {
	this.start = function(event) {
		this.position = $(elem).position();
		this.origin = {x: event.clientX, y: event.clientY};
		$(document).on("mousemove", this.move).on("mouseup", this.stop);
		return false;
	};
	this.move = (function(event) {
		$(elem).css({
			top: this.position.top + (event.clientY - this.origin.y),
			left: this.position.left + (event.clientX - this.origin.x)
		});
		return false;
	}).bind(this);
	this.stop = (function(event) {
		$(document).off("mousemove", this.move).off("mouseup", this.stop);
		if (onComplete) onComplete($(elem).position());
		return false;
	}).bind(this);
}

function Resizer(widthOf, heightOf, onComplete) {
	this.widthOf = widthOf;
	this.heightOf = heightOf;
	this.start = function(event) {
		this.size = {width: $(this.widthOf).width(), height: $(this.heightOf).height()};
		this.origin = {x: event.clientX, y: event.clientY};
		$(document).on("mousemove", this.move).on("mouseup", this.stop);
		return false;
	};
	this.move = (function(event) {
		$(this.widthOf).width(this.size.width + (event.clientX - this.origin.x));
		$(this.heightOf).height(this.size.height + (event.clientY - this.origin.y));
		return false;
	}).bind(this);
	this.stop = (function(event) {
		$(document).off("mousemove", this.move).off("mouseup", this.stop);
		if (onComplete) onComplete({width: $(this.widthOf).width(), height: $(this.heightOf).height()});
		return false;
	}).bind(this);
}

function Notifier() {
	var timer;
	this.show = function(text) {
		if (!document.hasFocus() && !timer) {
			var origText = document.title, counter = 0;
			timer = setInterval(function() {
				document.title = ++counter % 2 == 1 ? text : origText;
			}, 1000);
			$(window).on("focus", function() {
				clearInterval(timer);
				timer = 0;
				document.title = origText;
			});
		}
	};
}
