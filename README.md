# The View
The view framework was created with uncompromising goals.  It allows you to:
* Bind to data anywhere, your window object is the model
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
    Todo: {{#todos[#index].text}}.
    Status: {{#todos[#index].done ? "Done" : "Not done"}}.
</div>
```

Changing data will update the text.
```javascript
todos[0].text = "Buy groceries";		//Todo: Buy grociers. Status: Done
index = 1;								//Todo: Pick up mom from airport. Status: Not done
todos[1].done = true;					//Todo: Pick up mom from airport. Status: Done
index = 3;
todos.push({text: "Return shoes"});		//Todo: Return shoes. Status: Not done
```

http://jsfiddle.net/p9s1yjqc/


#### Bind-Repeater Directive
```html
<div bind-repeater-i="#todos.length">{{#todos[#i].text}}</div>
```


#### Bind-Statement Directive
```html
<div bind-repeater-i="#todos.length"
	bind-statement-1="thisElem.style.textDecoration = #todos[#i].done ? 'strike-through' : ''"
	bind-statement-2="thisElem.style.display = #todos[#i].done && #hideInactive ? 'none' : ''"
	bind-statement-3="$(thisElem).toggleClass(#i % 2 == 0 ? 'even-row' : 'odd-row')">
	{{#todos[#i].text}}
</div>
```

The bind-statement directive is the Swiss-army knife of data binding.  You use it to alter the appearance of the bound element depending on the value of some data source.

The special variable `thisElem` point to the current element.  The statement-_id_ can be any string, it is there only to make the attribute name unique, as required by HTML.  You may want to use a descriptive string as the id, for example: `bind-statement-strike-done` or `bind-statement-hide-inactive`.


#### Bind-Event Directive
```html
<div bind-repeater-i="#todos.length">
	<input type="checkbox" bind-event-change="#todos[#i].done = thisElem.checked" />
	{{#todos[#i].text}}
	<div class="delete-button" bind-event-click="#todos.splice(#i,1); doSomethingElse(event)" />
</div>
```

The special variable `event` contains the JQuery event object.

http://jsfiddle.net/8s2tbmcx/


#### Bind-Param Directive
```html
<div bind-repeater-i="#todos.length"
	bind-param-todo="#todos[#i]">
	{{#todo.text}}
</div>
```

Here is the complete TodoList example.  Notice how little you have had to learn in order to build this, compared to other frameworks.  And you built it without any code-behind, in other words 100% declarative!  You can build complex apps with just the above 4 directives.

http://rawgit.com/ken107/kenna-js/master/examples/todolist/todo.html


#### Bind-Context Directive
```html
function TodoList(elem, data) {
	this.deleteItem = function(index) {
		data.todos.splice(index,1);
	};
	this.toTitleCase = function(text) {...};
}

<div bind-context="new TodoList(thisElem, data)">
	<div bind-repeater-i="#todos.length">
		{{this.toTitleCase(#todos[#i].text)}}
		<div class="delete-button" bind-event-click="this.deleteItem(#i)" />
	</div>
</div>
```


#### Bind-Template Directive
```html
<div>
	<div bind-template="LoginForm"></div>
</div>
```

The inner div will be replaced by the template named _LoginForm_.  Register your templates with the global `dataBinder` object:
```javascript
dataBinder.templates = {
	LoginForm: ...
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

The `bind-template` and `bind-context` directives together allow you to build reusable _view components_.  See the Advanced section for an example.


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


#### View Components
In general a view component (or simply _view_) is a template backed by a class that acts as its controller/code-behind.  There are different ways to implement view components, the following is just one way.  Suppose your templates and controllers are defined in components.html and components.js:
```html
//components.html
<div data-class="TodoList">
	<div bind-repeater-i="#todos.length"
		bind-template="TodoItem"
		bind-param-text="#todos[#i].text"
		bind-event-delete-item="this.deleteItem(#i)" />
</div>
<div data-class="TodoItem">
	{{#text}}
	<div bind-template="DeleteButton" bind-event-click="this.onDelete()" />
</div>
<div data-class="DeleteButton">
</div>
```

```javascript
//components.js
function TodoList(elem, data) {
	this.deleteItem = function(index) {
		data.todos.splice(index,1);
	}
}
function TodoItem(elem, data) {
	this.onDelete = function() {
		$(elem).triggerHandler('delete-item');
	}
}
function DeleteButton(elem, data) {
}
```

Then you can load your components as follows.  As you load each template, you add a _bind-context_ directive that instantiates the controller and set it as the context (`this`) of the template.
```javascript
//load components
dataBinder.templateInheritsData = false;
dataBinder.autoBind = false;
$("<div/>").load("components.html", function() {
	$(this).children().each(function() {
		var className = this.getAttribute("data-class");
		if (className) {
			this.setAttribute("bind-context", "new " + className + "(thisElem, data)");
			dataBinder.templates[className] = this;
		}
	});
	dataBinder.autoBind = true;
});
```

The `templateInheritsData` config is true by default, which means templates inherit all data from its parent.  If set to false, no data is inherited, any data used by the template has to be passed in using the _bind-param_ directive.  Reusable components should require all parameters to be explicitly passed in, hence we set it to false.

http://rawgit.com/ken107/kenna-js/master/examples/todolist2/todo.html


# The Model
The supermodel.js is a Node app that provides MVC-Model as a service.  In your MVC application, you may have parts of the model reside on the server and synchronized to the clients.  For example, in an MVC chat application, your chat log resides on the server.  Each chat client keeps a copy of the chat log that is kept synchronized with the server via a PUB/SUB mechanism.  The controller, which reside on the server, receives new chat messages from clients and append them to the chat log.

Note the difference with an Angular-Firebase solution, where your controller resides with the views.  Kenna believes that the controller naturally should reside with the part of the model which it controls.  The benefits include server-side validation and better concurrency control.
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

Then open the file examples/sharedtodolist/todo.html in two or more browser windows.  If you use Chrome, you must run a local web server because Chrome does not allow AJAX over file:// URL.  This example reuses the TodoList components from the todolist2 example.
