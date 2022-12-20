(function() {
	var my = {
		onenterkey: "x-onenterkey",
		visible: "x-visible",
		linethrough: "x-linethrough",
		focus: "x-focus",
		checked: "x-checked",
		value: "x-value",
		disabled: "x-disabled",
		if: "x-if",
		foreach: "x-foreach-",
		attr: "x-attr-",
		style: "x-style-",
		toggleclass: "x-toggleclass-",
		onevent: "x-on"
	};

	dataBinder.onDataBinding = function(node) {
		var toRemove = [];
		for (var i=0; i<node.attributes.length; i++) {
			var attr = node.attributes[i];
			if (attr.specified) {
				if (attr.name == my.onenterkey)
					node.setAttribute("bind-event-keypress", "if (event.which == 13) {" + attr.value + "; return false}");
				else if (attr.name == my.visible)
					node.setAttribute("bind-statement-" + attr.name, "thisElem.style.display = " + attr.value + " ? '' : 'none'");
				else if (attr.name == my.linethrough)
					node.setAttribute("bind-statement-" + attr.name, "thisElem.style.textDecoration = " + attr.value + " ? 'line-through' : ''");
				else if (attr.name == my.focus)
					node.setAttribute("bind-statement-" + attr.name, "if (" + attr.value + ") thisElem.focus()");
				else if (attr.name == my.checked)
					node.setAttribute("bind-statement-" + attr.name, "thisElem.checked = " + attr.value);
				else if (attr.name == my.value)
					node.setAttribute("bind-statement-" + attr.name, "thisElem.value = " + attr.value);
				else if (attr.name == my.disabled)
					node.setAttribute("bind-statement-" + attr.name, "thisElem.disabled = " + attr.value);
				else if (attr.name == my.if)
					node.setAttribute("bind-repeater-if", attr.value + " ? 1 : 0");
				else if (attr.name.lastIndexOf(my.foreach,0) == 0) {
					node.setAttribute("bind-repeater-i", attr.value + ".length");
					node.setAttribute("bind-var-" + attr.name.substr(my.foreach.length), attr.value + "[#i]");
				}
				else if (attr.name.lastIndexOf(my.attr,0) == 0)
					node.setAttribute("bind-statement-" + attr.name, "thisElem.setAttribute('" + attr.name.substr(my.attr.length) + "', " + attr.value + ")");
				else if (attr.name.lastIndexOf(my.style,0) == 0)
					node.setAttribute("bind-statement-" + attr.name, "thisElem.style." + toCamelCase(attr.name.substr(my.style.length)) + " = " + attr.value);
				else if (attr.name.lastIndexOf(my.toggleclass,0) == 0)
					node.setAttribute("bind-statement-" + attr.name, "toggleClass(thisElem, '" + attr.name.substr(my.toggleclass.length) + "', " + attr.value + ")");
				else if (attr.name.lastIndexOf(my.onevent,0) == 0)
					node.setAttribute("bind-event-" + attr.name.substr(my.onevent.length), attr.value);
				else continue;
				toRemove.push(attr.name);
			}
		}
		for (var i=0; i<toRemove.length; i++) node.removeAttribute(toRemove[i]);
	};

	function toCamelCase(str) {
		return str.replace(/-([a-z])/g, function(g) {
			return g[1].toUpperCase();
		});
	}

	window.toggleClass = function(elem, className, toggle) {
		if (toggle) elem.className += " " + className;
		else elem.className = elem.className.replace(new RegExp("(?:^|\\s)" + className + "(?!\\S)", "g"), "");
	}
})();
