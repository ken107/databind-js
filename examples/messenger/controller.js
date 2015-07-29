
this.init = function(m) {
	m.users = {};
	trackKeys(m.users);
};

this.signIn = function(m, userInfo) {
	var user = m.users[userInfo.id];
	if (!user) {
		user = m.users[userInfo.id] = {id: userInfo.id, sessions: 0};
		defPrivate(user, "state", {showMessenger: false});
		defPrivate(user, "conversations", {});
		trackKeys(user.conversations);
	}
	user.name = userInfo.name;
	user.sessions++;
	m.session = {
		state: user.state,
		conversations: user.conversations,
	};
	defPrivate(m.session, "userInfo", userInfo);
	defPrivate(m.session, "onclose", function() {user.sessions--});
};

this.showMessenger = function(m, show) {
	m.session.state.showMessenger = show;
};

this.openChat = function(m, otherUserId) {
	if (otherUserId == m.session.userInfo.id) return;
	if (!m.session.conversations[otherUserId]) {
		var log = [];
		defPrivate(log, "lastModified", Date.now());
		m.session.conversations[otherUserId] = {log: log};
		m.users[otherUserId].conversations[m.session.userInfo.id] = {log: log};
	}
	m.session.conversations[otherUserId].open = true;
};

this.sendChat = function(m, otherUserId, message) {
	var log = m.session.conversations[otherUserId].log;
	log.push({
		sender: {id: m.session.userInfo.id, name: m.session.userInfo.name},
		text: message,
		time: (log.lastModified < Date.now()-5*60*1000) ? Date.now() : undefined
	});
	log.lastModified = Date.now();
	m.users[otherUserId].conversations[m.session.userInfo.id].open = true;
};

this.closeChat = function(m, otherUserId) {
	m.session.conversations[otherUserId].open = false;
};

this.resizeChat = function(m, otherUserId, size) {
	m.session.conversations[otherUserId].size = size;
};

this.moveChat = function(m, otherUserId, position) {
	m.session.conversations[otherUserId].position = position;
};
