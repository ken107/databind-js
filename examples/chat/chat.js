
this.init = function(model) {
	model.chatLog = ["Welcome!"];
};

this.sendChat = function(model, name, message) {
	model.chatLog.push(name + ": " + message);
};
