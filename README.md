# How to Use
Simply include JQuery and databind.js, and you're ready to use databinding on your page.
```html
<!-- for testing -->
<script src="http://rawgit.com/ken107/databind-js/master/databind.js"></script>
```

Declare your data sources, for example:
```javascript
window.tabs = [
	{title: "Yahoo", url: "http://yahoo.com"},
	{title: "Google", url: "http://google.com"}
];
window.selectedTab = 0;
```

### Text binding
```html
<div>
    Selected tab: {{#tabs[#selectedTab].title}}.
    Is HTTPS: {{#tabs[#selectedTab].url.substr(0,5) === "https" ? "true" : "false"}}
</div>
```

The framework automatically converts data source object properties into getter-setters using Object.defineProperty.  So any change in the data source will also update the text:
```javascript
tabs[0].title = "Yahoo!!";				//Selected tab: Yahoo!!. Is HTTPS: false
selectedTab = 1;						//Selected tab: Google. Is HTTPS: false
tabs[1].url = "https://google.com";		//Selected tab: Google. Is HTTPS: true
```

You can change/add/delete array elements.  But the framework has no way to detect array change, so you have to call `notifyArrayChange` to update the bindings:
```javascript
selectedTab = 2;
tabs.push({title: "Microsoft", url: "https://microsoft.com"});
dataBinder.notifyArrayChange(tabs);		//Selected tab: Microsoft. Is HTTPS: true
```

http://jsfiddle.net/ebo7jzts/2/

### Bind-repeater directive
```html
<div bind-repeater-i="#tabs.length">
	{{#tabs[#i].title}}
</div>
```

### Bind-statement directive
```html
<div bind-repeater-i="#tabs.length"
	bind-statement-1="thisElem.style.backgroundColor = (#i == #selectedTab ? 'blue' : 'black')"
	bind-statement-2="..."
	bind-statement-3="...">
	{{#tabs[#i].title}}
</div>
```

The bind-statement directive is the Swiss army knife of data binding.  You use it to alter the appearance and behavior of the bound element, depending on the value of some data source.

The special variable `thisElem` always point to the current element.

The statement-_id_ can be a string, it is there only to make the attribute name unique, as required by HTML.

### Bind-event directive
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

http://jsfiddle.net/wbpLLyvq/3/
http://jsfiddle.net/wbpLLyvq/4/
http://jsfiddle.net/wbpLLyvq/6/

### Bind-param directive
```html
<div bind-repeater-i="#tabs.length"
	bind-param-tab="#tabs[#i]">
	{{#tab.title}}
</div>
```

### Bind-context directive
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

### Bind-template directive
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

# Advanced
### Calling dataBind manually
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

### Customization
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
