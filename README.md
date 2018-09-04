## What's This?
Data binding allows you to detect changes to your data and react by updating the DOM.

## Installation
First add databind.js to your page.
```html
<script src="http://cdn.rawgit.com/ken107/databind-js/master/databind.js"></script>
```
Or `bower install databinder`.

## Detecting Changes To Your Data
Your data is whatever `this` points to, which is by the default the `window` object.  Say your window object has the following property:
```javascript
window.blog = {
	name: "My blog",
	entries: [
		{ title: "...", text: "...", isPublished: true },
		{ title: "...", text: "...", isPublished: false }
	]
}
```
To bind to the text of the first blog entry, for example, use the _binding expression_ `#blog.entries[0].text`.

## Updating the DOM
Set the text content of an element
```html
<h2>{{#blog.entries[0].title}}</h2>
<p>{{#blog.entries[0].text}}</p>
```

Hide/show an element
```html
<div bind-statement-1="thisElem.style.display = #blog.entries[0].isPublished ? 'block' : 'none'">
	{{#blog.entries[0].text}}
</div>
```

Change an image
```html
<img bind-statement-1="thisElem.src = #blog.entries[0].isPublished ? 'checked.png' : 'unchecked.png'" />
```

Toggle a CSS class (using jQuery)
```html
<li bind-statement-1="$(thisElem).toggleClass('published', #blog.entries[0].isPublished)">
	{{#blog.entries[0].title}}
</li>
```

Call a function
```html
<div bind-statement-1="doSomething(#blog.entries[0].text)"></div>
```

Say you want to repeat an element a number of times
```html
<div bind-repeater-i="#blog.entries.length">{{#blog.entries[#i].text}}</div>
```

Set the value of an text box
```html
<input type="text" bind-statement-1="thisElem.value = #blog.entries[0].title" />
```

Et cetera.

The `bind-statement` specifies a JavaScript statement that should be executed every time your data changes.  It is one of just 6 _binding directives_ that together let you write responsive apps of any complexity.  They're no less capable than Angular or React.

Proceed to the [documentation](https://github.com/ken107/databind-js/wiki/Home) for the full list of binding directives.

## Example
http://jsfiddle.net/wcoczs50/4/
