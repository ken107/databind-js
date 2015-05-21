# The View
The view framework was created with uncompromising goals.  It allows you to:
* Bind to data anywhere, any time
* Bind to arbitrary nodes in an object tree
* Use your binding in arbitrarily complex JavaScript expressions
* Declare your binding expressions directly in HTML, on the affected element
* Easily define reusable view templates or components that integrates seamlessly with data-binding semantics
* Do all the above with the absolute minimal set of new directives and syntax that you'll have to learn
* Easily customize and extend the framework

### USAGE
Simply include JQuery and databind.js, and you're ready to go.
```html
<script src="http://cdn.rawgit.com/ken107/kenna-js/master/databind.js"></script>
```

Declare your data sources, for example:
```javascript
tabs = [
	{title: "Yahoo", url: "http://yahoo.com"},
	{title: "Google", url: "http://google.com"}
];
selectedTab = 0;
```

#### Text Binding
```html
<div>
    Selected tab: {{#tabs[#selectedTab].title}}.
    Is HTTPS: {{#tabs[#selectedTab].url.substr(0,5) === "https" ? "true" : "false"}}
</div>
```

Changing data will update the text.
```javascript
tabs[0].title = "Yahoo!!";				//Selected tab: Yahoo!!. Is HTTPS: false
selectedTab = 1;						//Selected tab: Google. Is HTTPS: false
tabs[1].url = "https://google.com";		//Selected tab: Google. Is HTTPS: true
selectedTab = 2;
tabs.push({								//Selected tab: Microsoft. Is HTTPS: true
    title: "Microsoft",
	url: "https://microsoft.com"
});
```

http://jsfiddle.net/ysnj8g2h/

#### Bind-Repeater Directive
```html
<div bind-repeater-i="#tabs.length">
	{{#tabs[#i].title}}
</div>
```

#### Bind-Statement Directive
```html
<div bind-repeater-i="#tabs.length"
	bind-statement-1="thisElem.style.backgroundColor = (#i == #selectedTab ? 'blue' : 'black')"
	bind-statement-2="..."
	bind-statement-3="...">
	{{#tabs[#i].title}}
</div>
```

The bind-statement directive is the Swiss army knife of data binding.  You use it to alter the appearance of the bound element depending on the value of some data source.

The special variable `thisElem` always point to the current element.  The statement-_id_ can be any string, it is there only to make the attribute name unique, as required by HTML.

#### Bind-Event Directive
```html
function onTabClick(index, ev) {
	selectedTab = index;
}

<div bind-repeater-i="#tabs.length"
	bind-event-click="onTabClick(#i, event)">
	{{#tabs[#i].title}}
</div>
```

The special variable `event` contains the JQuery event object.

http://jsfiddle.net/63p2r7bd/1/
http://jsfiddle.net/63p2r7bd/4/

#### Bind-Param Directive
```html
<div bind-repeater-i="#tabs.length"
	bind-param-tab="#tabs[#i]">
	{{#tab.title}}
</div>
```

#### Bind-Context Directive
```html
function Tabs() {
	this.onTabClick = function() {...};
	this.toTitleCase = function() {...};
}

<div bind-context="new Tabs()">
	<div bind-repeater-i="#tabs.length"
		bind-event-click="this.onTabClick(#i)">
		{{this.toTitleCase(#tabs[#i].title)}}
	</div>
</div>
```

#### Bind-Template Directive
```html
<div>
	<div bind-template="LoginDialog"></div>
</div>
```

The inner div will be replaced by the template named _LoginDialog_.  Set your templates via the global `dataBinder` object:
```javascript
dataBinder.templates = {
	LoginDialog: ...
}
```

Usually you probably load your templates from an external file, in which case you need to turn autoBind off and turn it back on once your templates have been loaded:
```javascript
dataBinder.autoBind = false;
loadMyTemplates(function onComplete(myTemplates) {
	dataBinder.templates = myTemplates;
	dataBinder.autoBind = true;
});
```

### ADVANCED
#### Calling dataBind manually
By default the dataBinder auto-binds the entire document as soon as it is ready, by calling:
```javascript
$(document).ready(function() {
	$(document.body).dataBind(window, window);
})
```

You can disable auto-binding and call dataBind manually.  The method signature is:
```javascript
$(elem).dataBind(data, context);
```
where:
* _data_ is an object containing your binding sources
* _context_ is the value of the `this` keyword in your binding expressions

#### Customization
To define custom directives, set `dataBinder.onDataBinding` to a function that will be called before each node is bound.  Inside this function you can process your custom directives by macro-expanding them into binding directives.  For example:
```javascript
dataBinder.onDataBinding = function(node) {
	//visibility
	var expr = node.getAttribute("xx-visible");
	if (expr) node.setAttribute("bind-statement-set-visibility", expr + " ? $(thisElem).fadeIn() : $(thisElem).fadeOut()");
	
	//calling a global function to do the job
	expr = node.getAttribute("xx-transform");
	if (expr) node.setAttribute("bind-statement-set-transform", "window.setTransform(thisElem, " + expr + ")");
	
	//conditional
	expr = node.getAttribute("xx-if");
	if (expr) node.setAttribute("bind-repeater-i", expr + " ? 1 : 0");
};
```

You can also change the names of binding directives via `dataBinder.directives`.

# The Model
The supermodel.js is a Node app that provides MVC-Model as a service.  Your MVC application may have parts of its model reside on the server and synchronized to the clients, where the views are rendered.  For example, in an MVC chat application, your chat log resides on the server.  Each chat client keeps a copy of the chat log that is kept synchronized with the server via a PUB/SUB mechanism.  The controller, which reside on the server, receives new chat messages from clients and append them to the chat log.
```
  Usage: supermodel [options] <controller.js>

  Options:

    -h, --help         output usage information
    -V, --version      output the version number
    -h, --host <host>  listening ip or host name
    -p, --port <port>  listening port
```

The supermodel accepts client Websocket connections on a specific host and port (or *:8080 if not specified).  This connection is to be used for the PUB/SUB mechanism, as well as for sending controller actions (or events).  Each message is a Websocket text frame, the content of which is a JSON object containing a _cmd_ property whose value is one of "SUB", "PUB", "ACT", or "ERR".

#### SUB
Clients send a SUB message to the server to start listening for changes to the Model.  The message must contain a _pointers_ property which holds an array of JSON Pointers (RFC 6901) into the server's Model object:
```
{
    cmd: "SUB",
	pointers: [array of JSON Pointers]
}
```

#### PUB
Server sends a PUB message to notify clients of changes to the Model.  The message shall contain a _patches_ property, which holds an array of JSON Patches (RFC 6902) describing a series of changes that were made to the Model object.
```
{
    cmd: "SUB",
	patches: [array of JSON Patches]
}
```

#### ACT
Clients send an ACT message to the server to execute a controller action.  The message must contain a _method_ string property, and an _args_ array property.  The server shall invoke the specified controller method with the provided arguments.  More details about the controller later.
```
{
    cmd: "ACT",
	method: "action method",
	args: [array of arguments]
}
```

#### ERR
Server sends an ERR message to notify client that the previous request could not be completed.  The message shall contain an _id_ property whose value is taken from the property of the same name on the request message if present, a _code_ string property which contains an error code, and a _message_ property containing the error details.
```
{
    cmd: "ERR",
	id: request.id,
	code: "ERROR_CODE",
	message: "error message"
}
```

# The Controller
The controller.js provided to the Supermodel specifies the controller actions that can be invoked by the clients.  It must contain a series of method declarations on `this`, each method corresponding to one action:
```
this.method = function(model, ...args) {
    ....
};
```

Note that the first argument to the method is always the Model object, followed by the arguments provided by the client in the ACT message.

If a special method named `init` exists, it will be called automatically once when the controller starts up; this method can be used to initialize the Model.  Following is the controller for the sample MVC chat app:
```
this.init = function(model) {
	model.chatLog = ["Welcome!"];
};
this.sendChat = function(model, name, message) {
	model.chatLog.push(name + ": " + message);
};
```

#### Live Code Update
The Supermodel monitors the controller.js file for changes and automatically reloads it.  This allows code update without requiring restart.  This is useful in live applications since restarting the process causes loss of all client connections.
