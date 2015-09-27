## What's This?
In the context of MVVM, data binding is used to detect changes to the ViewModel and react by updating the View.

If you're confused about MVVM, MVC, MVP, MVVMC, or whatever, don't worry.  You don't need to understand them to use this library.  Simply, this library lets you listen for changes to your data (ViewModel), and do something about it, such as manipulating the DOM (View).

## How To Use
First add databind.js to your page.
```html
<script src="http://cdn.rawgit.com/ken107/databind-js/master/databind.js"></script>
```
Or `bower install databinder`.

##### Detecting Changes To The ViewModel
This library assumes your ViewModel is whatever `this` points to, which is by default your window object.
* Say your window object has a property _a_, then you can bind to _a_ like this: `#a`
* You can bind to some property of _a_ like this: `#a.b`
* In fact, you can bind any depth into _a_'s object tree: `#a.b.c[0].d.e`
* The array index can be another binding expression: `#a.b.c[Math.round(#x/2)+1].d.e`

##### Updating Your View
Using `#a.b.c[0].d.e` as an example, say you want to to set the text inside a DIV
```html
<div>The value is {{#a.b.c[0].d.e}}</div>
```

Say you want to hide the DIV if the value is NULL
```html
<div bind-statement-1="thisElem.style.display = (#a.b.c[0].d.e == null) ? 'none' : 'block'">
	Hello, world
</div>
```

Change an image dynamically
```html
<img bind-statement-1="thisElem.src = #a.b.c[0].d.e ? 'checked.png' : 'unchecked.png'" />
```

Toggle a class (using jQuery)
```html
<li bind-statement-1="$(thisElem).toggleClass('active', #a.b.c[0].d.e)">
	Menu item
</li>
```

Call a function
```html
<div bind-statement-1="setDivHeight(thisElem, #a.b.c[0].d.e)"></div>
```

Say you want to repeat an element a number of times
```html
<div bind-repeater-i="#a.b.c.length">Value is {{#a.b.c[#i].d.e}}</div>
```

Set the value of an text box
```html
<input type="text" bind-statement-1="thisElem.value = #a.b.c[0].d.e" />
```

Or a checkbox
```html
<input type="checkbox" bind-statement-1="thisElem.checked = #a.b.c[0].d.e" />
```

Remember these are bound to your data, so if the value of `a.b.c[0].d.e` changes your DOM will automatically be updated.  For example, any of the following will cause an update:
```javascript
a = ...;
a.b = ...;
a.b.c = [...];
a.b.c[0] = ...;
a.b.c.shift();
a.b.c[0].d = ...;
a.b.c[0].d.e = ...;
delete a.b;
//etc.
```

A quick example: http://jsfiddle.net/wcoczs50/

Proceed to the [documentation](https://github.com/ken107/databind-js/wiki/Home) for the full list of binding constructs.
