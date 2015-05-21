var program = require("commander"),
	fs = require("fs"),
	WebSocketServer = require("ws").Server,
	jsonpointer = require("jsonpointer"),
	jsonpatch = require("fast-json-patch"),
	model = {},
	actions = {};

program
	.version("0.0.1")
	.usage("[options] <controller.js>")
	.option("-h, --host <host>", "listening ip or host name", "0.0.0.0")
	.option("-p, --port <port>", "listening port", parseInt, 8080)
	.parse(process.argv);

if (program.args.length != 1) program.help();
var code = fs.readFileSync(program.args[0], {encoding: "utf-8"});
new Function(code).call(actions);
if (actions.init) actions.init(model);

fs.watchFile(program.args[0], function(curr, prev) {
	if (curr.mtime.getTime() != prev.mtime.getTime()) {
		console.log("Reloading app");
		fs.readFile(program.args[0], {encoding: "utf-8"}, function(err, code) {
			if (err) {
				console.log(err.stack);
				return;
			}
			try {
				new Function(code).call(actions);
			}
			catch (err) {
				console.log(err.stack);
			}
		});
	}
});

var wss = new WebSocketServer({host: program.host, port: program.port});
wss.on("connection", function(ws) {
	ws.on("message", function(text) {
		var m = {};
		try {
			m = JSON.parse(text);
			if (!(m instanceof Object)) throw {code: "BAD_REQUEST", message: "Message must be a JSON object"};
			if (!m.cmd) throw {code: "BAD_REQUEST", message: "Missing param 'cmd'"};
			if (m.cmd === "SUB") {
				if (!m.pointers) throw {code: "BAD_REQUEST", message: "Missing param 'pointers'"};
				if (!(m.pointers instanceof Array)) throw {code: "BAD_REQUEST", message: "Param 'pointers' must be an array"};
				m.pointers.forEach(subscribe);
			}
			else if (m.cmd === "ACT") {
				if (m.method === "init") throw {code: "FORBIDDEN", message: "Method 'init' is called automatically only once at startup"};
				if (!(actions[m.method] instanceof Function)) throw {code: "NOT_FOUND", message: "Method '" + m.method + "' not found"};
				actions[m.method].apply(actions, [model].concat(m.args));
			}
			else throw {code: "BAD_REQUEST", message: "Unknown command '" + m.cmd + "'"};
		}
		catch (err) {
			if (err.stack) console.log(err.stack);
			sendError(m.id, err.code || "ERROR", err.message);
		}
	});
	function subscribe(pointer) {
		var o = jsonpointer.get(model, pointer);
		if (!(o instanceof Object)) throw {code: "NOT_FOUND", message: "No object at '" + pointer + "'"};
		sendPatches(pointer, jsonpatch.compare({}, o));
		var observer = jsonpatch.observe(o, function(patches) {
			sendPatches(pointer, patches);
		});
		ws.on("close", function() {
			jsonpatch.unobserve(o, observer);
		});
	}
	function sendPatches(pointer, patches) {
		for (var i=0; i<patches.length; i++) {
			patches[i].path = pointer + patches[i].path;
			if (patches[i].from) patches[i].from = pointer + patches[i].from;
		}
		ws.send(JSON.stringify({cmd: "PUB", patches: patches}));
	}
	function sendError(id, code, message) {
		ws.send(JSON.stringify({cmd: "ERR", id: id, code: code, message: message}));
	}
});
