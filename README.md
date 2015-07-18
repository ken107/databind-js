# What Is It
Kenna offers:
- Powerful, flexible data binding syntax
- Simple and intuitive way to create reusable components
- A Push Model implementation


# Data Binding
To enable data binding on your page, simply include JQuery and databind.js.
```html
<script src="http://cdn.rawgit.com/ken107/kenna-js/master/databind.js"></script>
```

Declare your data sources, for example:
```javascript
todos = [
	{text: "Groceries", done: true},
	{text: "Pick up mom from airport"},
	{text: "Pay credit card bill"}
];
index = 0;
```


#### Text Binding
```html
<div>
    {{#todos[#index].text}} --> {{#todos[#index].done ? "Done" : "Not done"}}.
</div>
```

Changing data will update the text.
```javascript
todos[0].text = "Buy groceries";		//Buy groceries --> Done
index = 1;								//Pick up mom from airport --> Not done
todos[1].done = true;					//Pick up mom from airport --> Done
index = 3;
todos.push({text: "Return shoes"});		//Return shoes --> Not done
```

http://jsfiddle.net/p9s1yjqc/1/


#### Bind-Repeater Directive
```html
<div bind-repeater-i="#todos.length">{{#todos[#i].text}}</div>
```


#### Bind-Statement Directive
```html
<div bind-repeater-i="#todos.length"
	bind-statement-1="thisElem.style.textDecoration = #todos[#i].done ? 'line-through' : ''"
	bind-statement-2="thisElem.style.display = #todos[#i].done && #hideInactive ? 'none' : ''"
	bind-statement-3="$(thisElem).toggleClass(#i % 2 == 0 ? 'even-row' : 'odd-row')">
	{{#todos[#i].text}}
</div>
```

The bind-statement directive lets you execute a JavaScript statement whenever some data changes.  The special variable `thisElem` points to the current element.

The statement-_id_ can be any string, it is there only to make the attribute name unique, as required by HTML.  You may want to use a descriptive string as the _id_, for example: `bind-statement-strike-done` or `bind-statement-hide-inactive`.


#### Bind-Event Directive
```html
<div bind-repeater-i="#todos.length">
	<input type="checkbox" bind-event-change="#todos[#i].done = thisElem.checked" />
	{{#todos[#i].text}}
	<div class="delete-button" bind-event-click="#todos.splice(#i,1); doSomethingElse(event)" />
</div>
```

The special variable `event` contains the JQuery event object.

http://jsfiddle.net/8s2tbmcx/1/


#### Bind-Var Directive
```html
<div bind-repeater-i="#todos.length"
	bind-var-item="#todos[#i]"
	bind-var-status="#todos[#i].done ? 'completed' : 'active'">
	{{#item.text}} is {{#status}}
</div>
```

Here is the full TodoList example.

http://rawgit.com/ken107/kenna-js/master/examples/todolist/todo.html


# Components
#### Bind-View & Bind-Param Directives
```html
<div>
	<div bind-view="Greeting" bind-param-name="#myName"></div>
</div>
```

The inner div will be replaced by the view named _Greeting_.  Declare your views with the global `dataBinder` object:
```javascript
dataBinder.views = {
	Greeting: {
		template: $("<div bind-event-click='this.close()'>{{#greet+this.toTitleCase(#name)}}</div>").get(0),
		controller: function(elem) {
			this.greet = "Hello, ";
			this.toTitleCase = function(text) {...};
			this.close = function() {$(elem).hide()};
		}
	}
}
```

You use the bind-param directive to pass data into your view.  These params actually become properties of `this`, so you can bind to them as `#name` and refer to them in your controller code as `this.name`.

Normally you load your templates from an external file.  If this is the case, you will need to disable the `autoBind` function, and re-enable it once your templates have finished loading and are ready to be used.  See the following example for how to do that.

http://rawgit.com/ken107/kenna-js/master/examples/todolist2/todo.html


## Customization

View the [wiki](https://github.com/ken107/kenna-js/wiki/Advanced) to learn about advanced functions such as defining custom directives, changing the names of binding directives, or calling dataBind manually.


# Push Model
A Push Model is one that sits on the server and push changes to its clients.  A Push Model is useful in live applications, where it's necessary to have a synchronized view state across all clients.

Chat is a good example.  In an MVC chat application, your chat log lives on the server.  Each chat client has a copy of the chat log that is kept synchronized with the server via a PUB/SUB mechanism.  The controller (also on server) receives new chat messages from clients and append them to the chat log.

Our Push Model implementation is a Node app called "supermodel".  It uses `Object.observe` to monitor change (requires Node 0.11.13 or higher).
```
  Usage: supermodel [options] <controller.js>

  Options:

    -h, --help         output usage information
    -V, --version      output the version number
    -h, --host <host>  listening ip or host name
    -p, --port <port>  listening port
```

The supermodel accepts client Websocket connections on a specific host and port (or *:8080 if not specified).  This connection is to be used for the PUB/SUB mechanism, as well as for sending controller actions.  Each message is a Websocket text frame, the content of which is a JSON object containing a _cmd_ property whose value is one of "SUB", "UNSUB", "PUB", or "ACT".

#### SUB/UNSUB
Clients send a SUB/UNSUB message to the server to start/stop listening for changes to the Model.  The message must contain a _pointers_ property which holds an array of JSON Pointers (RFC 6901) into the Model object:
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


## The Controller
The controller.js provided to the supermodel specifies the controller actions that can be invoked by the clients.  It must contain a series of method declarations on `this`, each method corresponding to one action:
```javascript
this.method = function(model, ...args) {
    ....
};
```

Note that the first argument to the method is always the Model object, followed by the arguments provided by the client in the ACT message.

If a special method named `init` exists, it will be called automatically once when the controller starts up; this method can be used to initialize the Model.  Following is the controller for the sample MVC chat app:
```javascript
this.init = function(model) {
	model.chatLog = ["Welcome!"];
};
this.sendChat = function(model, name, message) {
	model.chatLog.push(name + ": " + message);
};
```

#### Live Code Update
The Supermodel monitors the controller.js file for changes and automatically reloads it.  This allows code update without requiring restart.  This is useful in live applications since restarting the process causes loss of all client connections.

#### Running the Chat Example
Open a command prompt in the kenna-js directory and run:
```
npm install
node supermodel.js examples/chat/chat.js
```

That will start the chat controller on localhost:8080.  Then open the file examples/chat/chat.html in two browser windows and start chatting!

#### Running the Shared TodoList Example
Open a command prompt in the kenna-js directory and run:
```
npm install
node supermodel.js examples/sharedtodolist/todo_controller.js
```

Then open the file examples/sharedtodolist/todo.html in two or more browser windows.  If you use Chrome, you must run a local web server because Chrome does not allow AJAX over file:// URL.  This example reuses the TodoList view from the todolist2 example.
