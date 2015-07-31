## What Can I do With This?
Say you have some data, and you want to know when they change so you can do something with it, like update your display, then this library is for you.

## How To Use
##### 1. Add databind.js to your page.
```html
<script src="http://cdn.rawgit.com/ken107/databind-js/master/databind.js"></script>
```

##### 2. Bind to your data.
* Say you have a global variable _a_, then you can bind to _a_ like this: `#a`
* You can bind to some property of _a_ like this: `#a.b`
* In fact, you can bind any depth into _a_'s object tree: `#a.b.c[0].d.e`
* You can use any expression as the array index: `#a.b.c[Math.round(#x/2)+1].d.e`

##### 3. Use your binding to manipulate the DOM
Say you want to set the text inside a div
```html
<div>Value is {{#a.b.c[0].d.e}}</div>
```

Say you want to hide the div if the value is null
```html
<div bind-statement-1="thisElem.style.display = (#a.b.c[0].d.e == null) ? 'none' : 'block'">
	Hello, world
</div>
```

Change an image
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

Say you want to set the value of an text box
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

Proceed to the [documentation](https://github.com/ken107/databind-js/wiki/Home) for the full list of binding constructs.
