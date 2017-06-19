/**
 * DataBinder <https://github.com/ken107/databind-js>
 * Copyright 2015, Hai Phan <hai.phan@gmail.com>
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
(function() {
	var regex = [
		/{{[\s\S]*?}}/g,
		/^\s*parts\[0\].get\(\)\s*$/,
		/'.*?'|".*?"|#\w+(?:\.\w+|\[(?:.*?\[.*?\])*?[^\[]*?\])*(\s*(?:\+\+|--|\+=|-=|\*=|\/=|%=|=(?!=)|\())?/g,
		/\.\w+|\[(?:.*?\[.*?\])*?[^\[]*?\]/g,
		/\bthis\.(\w+)\s*\(/g,
		/-([a-z])/g,
		/;\s*\S/,
		/^\d+$/
	];
	var propPrefix = "__prop__";
	var exprCache = {};

	/**
	 * Helpers
	 */
	var callLater = (function() {
		var queue = null;
		function call() {
			while (queue.length) {
				var funcs = queue;
				queue = [];
				for (var i=0; i<funcs.length; i++) funcs[i].cl_called = false;
				for (var priority=1; priority<=3; priority++)
				for (var i=0; i<funcs.length; i++) if (funcs[i].cl_priority == priority && !funcs[i].cl_called) {
					funcs[i]();
					funcs[i].cl_called = true;
				}
			}
			queue = null;
		}
		return function(func, priority) {
			if (!queue) {
				queue = [];
				setTimeout(call, 0);
			}
			func.cl_priority = priority;
			queue.push(func);
		};
	})();

	var timer = new function() {
		var queue = null;
		var counter = 0;
		var intervalId = 0;
		function onTimer() {
			var now = new Date().getTime();
			for (var id in queue) {
				if (queue[id].expires <= now) {
					queue[id].callback();
					delete queue[id];
				}
			}
			for (var id in queue) return;
			queue = null;
			clearInterval(intervalId);
		}
		this.callAfter = function(timeout, func) {
			if (!queue) {
				queue = {};
				intervalId = setInterval(onTimer, api.timerInterval);
			}
			var id = ++counter;
			queue[id] = {expires: new Date().getTime()+timeout, callback: func};
			return id;
		};
		this.cancel = function(id) {
			if (queue) delete queue[id];
		};
	};

	function getDirectives(node) {
		var dirs = {params: [], vars: [], statements: [], events: [], toRemove: []};
		for (var i=0; i<node.attributes.length; i++) {
			var attr = node.attributes[i];
			if (attr.specified) {
				if (attr.name == api.directives.bindView) {
					dirs.view = attr.value;
					dirs.toRemove.push(attr.name);
				}
				else if (attr.name.lastIndexOf(api.directives.bindParameter,0) == 0) {
					dirs.params.push({name: toCamelCase(attr.name.substr(api.directives.bindParameter.length)), value: attr.value});
					dirs.toRemove.push(attr.name);
				}
				else if (attr.name.lastIndexOf(api.directives.bindVariable,0) == 0) {
					dirs.vars.push({name: toCamelCase(attr.name.substr(api.directives.bindVariable.length)), value: attr.value});
					dirs.toRemove.push(attr.name);
				}
				else if (attr.name.lastIndexOf(api.directives.bindStatement,0) == 0) {
					dirs.statements.push({value: "; " + attr.value});
					dirs.toRemove.push(attr.name);
				}
				else if (attr.name.lastIndexOf(api.directives.bindEvent,0) == 0) {
					dirs.events.push({name: attr.name.substr(api.directives.bindEvent.length), value: "; " + attr.value});
					dirs.toRemove.push(attr.name);
				}
				else if (attr.name.lastIndexOf(api.directives.bindRepeater,0) == 0) {
					dirs.repeater = {name: toCamelCase(attr.name.substr(api.directives.bindRepeater.length)), value: attr.value};
					dirs.toRemove = [attr.name];
					break;
				}
			}
		}
		return dirs;
	}

	function removeDirectives(node, dirs) {
		for (var i=0; i<dirs.toRemove.length; i++) node.removeAttribute(dirs.toRemove[i]);
	}

	function toCamelCase(str) {
		return str.replace(regex[5], function(g) {
			return g[1].toUpperCase();
		});
	}

	function noOp() {
	}

	function illegalOp() {
		throw new Error("Illegal operation");
	}

	function printDebug(debugInfo) {
		if (debugInfo.length) api.console.log(debugInfo);
	}

	function proxy(func, ctx) {
		var args = Array.prototype.slice.call(arguments, 2);
		return function() {
			return func.apply(ctx, args.concat(Array.prototype.slice.call(arguments)));
		};
	}

	function makeEventHandler(node, type, scope, prop) {
		function handler(event) {
			scope.event = event;
			var val = prop.get();
			if (val == false && event) {
				if (event.preventDefault instanceof Function) event.preventDefault();
				if (event.stopPropagation instanceof Function) event.stopPropagation();
			}
			return val;
		}
		function jQueryHandler(event) {
			event.data = arguments.length > 2 ? Array.prototype.slice.call(arguments, 1) : arguments[1];
			scope.event = event;
			return prop.get();
		}
		var camel = toCamelCase(type);
		if (window.jQuery) {
			jQuery(node).on(type, jQueryHandler);
			if (camel != type) jQuery(node).on(camel, jQueryHandler);
		}
		else {
			node.addEventListener(type, handler, false);
			if (camel != type) node.addEventListener(camel, handler, false);
		}
	}

	/**
	 * Property
	 */
	function Property(value, onSubscribed) {
		var subscribers = {};
		var count = 0;
		var keygen = 0;
		this.get = function() {
			return value;
		};
		this.set = function(newValue) {
			if (newValue !== value) {
				value = newValue;
				publish();
			}
		};
		this.subscribe = function(subscriber) {
			if (!count && onSubscribed) onSubscribed(true);
			subscribers[++keygen] = subscriber;
			count++;
			return keygen;
		};
		this.unsubscribe = function(key) {
			if (!subscribers[key]) throw new Error("Not subscribed");
			delete subscribers[key];
			count--;
			if (!count && onSubscribed) onSubscribed(false);
		};
		this.publish = publish;
		function publish() {
			for (var i in subscribers) subscribers[i]();
		};
	}

	function extend(data) {
		return {__extends__: data};
	}

	function getPropExt(obj, name) {
		if (obj[propPrefix+name]) return obj[propPrefix+name];
		else if (name in obj) return convertToProperty(obj, name);
		else if (obj.__extends__) return getPropExt(obj.__extends__, name);
		else return null;
	}

	function getProp(obj, name) {
		return obj[propPrefix+name] || convertToProperty(obj, name);
	}

	function setProp(obj, name, prop) {
		if (prop instanceof Property) {
			Object.defineProperty(obj, propPrefix+name, {value: prop, writable: false, enumerable: false, configurable: false});
			Object.defineProperty(obj, name, {get: prop.get, set: prop.set, enumerable: true, configurable: false});
		}
		else throw new Error("Not a Property object");
	}

	function convertToProperty(obj, name) {
		var prop = new Property(obj[name]);
		Object.defineProperty(obj, propPrefix+name, {value: prop, writable: false, enumerable: false, configurable: false});
		if (obj instanceof Array) {
			observeArray(obj);
			var isArrayIndex = regex[7].test(name);
			if (!isArrayIndex || name < obj.length) {
				var desc = Object.getOwnPropertyDescriptor(obj, name);
				if (!desc || desc.configurable) Object.defineProperty(obj, name, {get: prop.get, set: prop.set, enumerable: true, configurable: isArrayIndex});
				else {
					if (name !== "length") api.console.warn("Object", obj, "property '" + name + "' is not configurable, change may not be detected");
					prop.get = fallbackGet;
					prop.set = fallbackSet;
				}
			}
		}
		else {
			var desc = Object.getOwnPropertyDescriptor(obj, name);
			if (!desc || desc.configurable) Object.defineProperty(obj, name, {get: prop.get, set: prop.set, enumerable: true, configurable: false});
			else {
				api.console.warn("Object", obj, "property '" + name + "' is not configurable, change may not be detected");
				prop.get = fallbackGet;
				prop.set = fallbackSet;
			}
		}
		function fallbackGet() {
			return obj[name];
		}
		function fallbackSet(newValue) {
			if (newValue !== obj[name]) {
				obj[name] = newValue;
				prop.publish();
			}
		}
		return prop;
	}

	function observeArray(arr) {
		if (arr.alter) return;
		arr.alter = alterArray;
		arr.push = proxy(arr.alter, arr, arr.push);
		arr.pop = proxy(arr.alter, arr, arr.pop);
		arr.shift = proxy(arr.alter, arr, arr.shift);
		arr.unshift = proxy(arr.alter, arr, arr.unshift);
		arr.splice = proxy(arr.alter, arr, arr.splice);
		arr.reverse = proxy(arr.alter, arr, arr.reverse);
		arr.sort = proxy(arr.alter, arr, arr.sort);
		if (arr.fill) arr.fill = proxy(arr.alter, arr, arr.fill);
	}

	function alterArray(func) {
		var len = this.length;
		var val = func.apply(this, Array.prototype.slice.call(arguments, 1));
		if (len != this.length) {
			var prop = this[propPrefix+"length"];
			if (prop) prop.publish();
		}
		for (var i=len; i<this.length; i++) {
			var prop = this[propPrefix+i];
			if (prop) {
				prop.set(this[i]);
				Object.defineProperty(this, i, {get: prop.get, set: prop.set, enumerable: true, configurable: true});
			}
		}
		return val;
	}

	/**
	 * Expression
	 */
	function parseExpr(str, debugInfo) {
		var funcs = [];
		var match;
		while (match = regex[4].exec(str)) funcs.push(match[1]);
		var strings = [];
		var parts = [];
		var pmap = {};
		var expr = str.replace(regex[2], function(bindingSrc, operator) {
			if (bindingSrc.charAt(0) == "'" || bindingSrc.charAt(0) == '"') {
				strings.push(bindingSrc.substr(1, bindingSrc.length-2));
				return "strings[" + (strings.length-1) + "]";
			}
			else if (operator) {
				if (operator.slice(-1) == "(") {
					parts.push({bindingSrc: bindingSrc.substring(1, bindingSrc.length-operator.length)});
					return "(parts[" + (parts.length-1) + "].get() || noOp)" + operator;
				}
				else {
				parts.push({bindingSrc: bindingSrc.substring(1, bindingSrc.length-operator.length), operator: operator});
				return "parts[" + (parts.length-1) + "].value" + operator;
				}
			}
			else if (pmap[bindingSrc]) return pmap[bindingSrc];
			else {
				parts.push({bindingSrc: bindingSrc.substr(1)});
				return pmap[bindingSrc] = "parts[" + (parts.length-1) + "].get()";
			}
		});
		var isSinglePart = regex[1].test(expr);
		if (!regex[6].test(expr)) expr = "return " + expr;
		expr = "var thisElem = scope.thisElem, event = scope.event;\n" + expr;
		var func;
		try {
			func = new Function("noOp", "scope", "strings", "parts", expr);
		}
		catch (err) {
			printDebug(debugInfo);
			throw err;
		}
		return {
			funcs: funcs,
			strings: strings,
			parts: parts,
			isSinglePart: isSinglePart,
			func: func
		};
	}

	function evalExpr(str, data, context, scope, debugInfo) {
		debugInfo = debugInfo.concat("{{" + str + "}}");
		var c = exprCache[str] || (exprCache[str] = parseExpr(str, debugInfo));
		for (var i=0; i<c.funcs.length; i++) {
			if (context[c.funcs[i]] === undefined) {
				printDebug(debugInfo);
				throw new Error("Method '" + c.funcs[i] + "' not found");
			}
		}
		var parts = [];
		for (var i=0; i<c.parts.length; i++) {
			var prop = evalBindingSrc(c.parts[i].bindingSrc, data, context, scope, debugInfo);
			if (c.parts[i].operator) {
				var part = {subscribe: noOp, unsubscribe: noOp};
				Object.defineProperty(part, "value", {get: prop.get, set: prop.set, enumerable: true, configurable: false});
				parts.push(part);
			}
			else parts.push(prop);
		}
		if (c.isSinglePart) return parts[0];

		var keys = new Array(parts.length);
		var prop = new Property(null, function(subscribed) {
			if (subscribed) for (var i=0; i<parts.length; i++) subscribePart(parts[i], i);
			else for (var i=0; i<parts.length; i++) unsubscribePart(parts[i], i);
		});
		prop.isExpr = true;
		prop.set = illegalOp;
		prop.get = function() {
			try {
				return c.func.call(context, noOp, scope, c.strings, parts);
			}
			catch (err) {
				printDebug(debugInfo);
				throw err;
			}
		};

		function subscribePart(part, i) {
			keys[i] = part.subscribe(prop.publish);
		}
		function unsubscribePart(part, i) {
			part.unsubscribe(keys[i]);
		}
		return prop;
	}

	function evalText(str, data, context, scope, debugInfo) {
		var exprs = str.match(regex[0]);
		if (!exprs) return null;
		var parts = new Array(exprs.length);
		for (var i=0; i<exprs.length; i++) parts[i] = evalExpr(exprs[i].substr(2, exprs[i].length-4), data, context, scope, debugInfo);

		var keys = new Array(parts.length);
		var prop = new Property(null, function(subscribed) {
			if (subscribed) for (var i=0; i<parts.length; i++) subscribePart(parts[i], i);
			else for (var i=0; i<parts.length; i++) unsubscribePart(parts[i], i);
		});
		prop.set = illegalOp;
		prop.get = function() {
			var i = 0;
			return str.replace(regex[0], function() {
				var val = parts[i++].get();
				return val != null ? String(val) : "";
			});
		};

		function subscribePart(part, i) {
			keys[i] = part.subscribe(prop.publish);
		}
		function unsubscribePart(part, i) {
			part.unsubscribe(keys[i]);
		}
		return prop;
	}

	function evalBindingSrc(str, data, context, scope, debugInfo) {
		var path = ("." + str).match(regex[3]);
		var derefs = new Array(path.length);
		for (var i=0; i<path.length; i++) {
			if (path[i].charAt(0) === '.') derefs[i] = path[i].substr(1);
			else derefs[i] = evalExpr(path[i].substr(1, path[i].length-2), data, context, scope, debugInfo);
		}
		var parts = new Array(path.length);
		parts[0] = getPropExt(data, derefs[0]);
		if (!parts[0]) {
			printDebug(debugInfo);
			throw new Error("Missing binding source for #" + str);
		}
		if (parts.length == 1) return parts[0];

		var curVal;
		var derefKeys = new Array(path.length);
		var keys = new Array(path.length);
		var isSubscribed = false;
		var prop = new Property(null, function(subscribed) {
			isSubscribed = subscribed;
			if (subscribed) {
				buildParts();
				for (var i=0; i<parts.length; i++) subscribePart(parts[i], i);
				for (var i=0; i<derefs.length; i++) subscribeDeref(derefs[i], i);
			}
			else {
				for (var i=0; i<parts.length; i++) unsubscribePart(parts[i], i);
				for (var i=0; i<derefs.length; i++) unsubscribeDeref(derefs[i], i);
			}
		});
		prop.set = function(newValue) {
			if (!isSubscribed) buildParts();
			var val = parts[parts.length-1];
			if (val instanceof Property) val.set(newValue);
			else {
				printDebug(debugInfo);
				throw new Error("Can't assign to #" + str + ", object is undefined");
			}
		};
		prop.get = function() {
			if (!isSubscribed) buildParts();
			if (curVal instanceof Function) {
				var ctx = context;
				if (parts.length > 1) {
					ctx = parts[parts.length-2];
					if (ctx instanceof Property) ctx = ctx.get();
				}
				return function() {
					return curVal.apply(ctx, arguments);
				};
			}
			else return curVal;
		};

		function evalPart(i) {
			var val = parts[i-1] instanceof Property ? parts[i-1].get() : parts[i-1];
			if (val instanceof Object) {
				var deref = derefs[i] instanceof Property ? derefs[i].get() : derefs[i];
				return getProp(val, deref);
			}
			else if (typeof val === "string") {
				var deref = derefs[i] instanceof Property ? derefs[i].get() : derefs[i];
				return val[deref];
			}
			else return undefined;
		}
		function buildParts() {
			for (var i=1; i<parts.length; i++)
				parts[i] = evalPart(i);
			curVal = parts[parts.length-1] instanceof Property ? parts[parts.length-1].get() : parts[parts.length-1];
		}
		function rebuildPartsFrom(index) {
			for (var i=index; i<parts.length; i++) {
				var val = evalPart(i);
				if (val !== parts[i]) {
					unsubscribePart(parts[i], i);
					parts[i] = val;
					subscribePart(val, i);
				}
				else return false;
			}
			var oldVal = curVal;
			curVal = parts[parts.length-1] instanceof Property ? parts[parts.length-1].get() : parts[parts.length-1];
			return curVal !== oldVal || curVal instanceof Function;
		}
		function subscribePart(part, i) {
			if (part instanceof Property) {
				keys[i] = part.subscribe(function() {
					if (rebuildPartsFrom(i+1)) prop.publish();
				});
			}
		}
		function subscribeDeref(deref, i) {
			if (deref instanceof Property) {
				derefKeys[i] = deref.subscribe(function() {
					if (rebuildPartsFrom(i)) prop.publish();
				});
			}
		}
		function unsubscribePart(part, i) {
			if (part instanceof Property)
				part.unsubscribe(keys[i]);
		}
		function unsubscribeDeref(deref, i) {
			if (deref instanceof Property)
				deref.unsubscribe(derefKeys[i]);
		}
		return prop;
	}

	/**
	 * Binding
	 */
	function Binding(prop, priority) {	//priority 0=synchronous 1,2,3=asynchronous
		var self = this;
		var subkey = null;
		function notifyChange() {
			if (subkey) self.onChange();
		}
		this.bind = function() {
			if (subkey) throw new Error("Already bound");
			subkey = prop.subscribe(priority == 0 ? notifyChange : function() {
				callLater(notifyChange, priority);
			});
			self.onChange();
		};
		this.unbind = function() {
			if (subkey) {
				prop.unsubscribe(subkey);
				subkey = null;
				if (self.onUnbind) self.onUnbind();
			}
		};
		this.isBound = function() {
			return Boolean(subkey);
		};
	}

	function BindingStore() {
		this.bindings = [];
		this.unbind = function() {
			for (var i=0; i<this.bindings.length; i++) this.bindings[i].unbind();
		};
		this.rebind = function() {
			for (var i=0; i<this.bindings.length; i++) this.bindings[i].bind();
		};
	}

	function Repeater(name, node, data, context, debugInfo) {
		var parent = node.parentNode;
		var tail = node.nextSibling;
		parent.removeChild(node);
		var count = 0;
		var bindingStores = [];
		var cache = document.createDocumentFragment();
		var cacheTimeout = null;
		this.update = function(newCount) {
			newCount = Number(newCount);
			if (isNaN(newCount) || newCount < 0) newCount = 0;
			if (newCount > count) {
				var newElems = document.createDocumentFragment();
				var toBind = [];
				for (var i=count; i<newCount; i++) {
					if (cache.firstChild) {
						newElems.appendChild(cache.firstChild);
						bindingStores[i].rebind();
					}
					else {
						var newElem = node.cloneNode(true);
						newElems.appendChild(newElem);
						var newData = data;
						if (name) {
							newData = extend(data);
							setProp(newData, name, new Property(i));
						}
						var bindingStore = new BindingStore();
						bindingStores.push(bindingStore);
						dataBind(newElem, newData, context, bindingStore, debugInfo);
					}
				}
				parent.insertBefore(newElems, tail);
			}
			else if (newCount < count) {
				var elem = tail ? tail.previousSibling : parent.lastChild;
				for (var i=count-1; i>=newCount; i--) {
					var prevElem = elem.previousSibling;
					bindingStores[i].unbind();
					cache.insertBefore(elem, cache.firstChild);
					elem = prevElem;
				}
			}
			count = newCount;
			if (cacheTimeout) {
				timer.cancel(cacheTimeout);
				cacheTimeout = null;
			}
			if (cache.firstChild && api.repeaterCacheTTL) {
				cacheTimeout = timer.callAfter(api.repeaterCacheTTL, clearCache);
			}
		};
		function clearCache() {
			while (cache.lastChild) {
				bindingStores.pop();
				if (window.jQuery) jQuery(cache.lastChild).remove();
				else cache.removeChild(cache.lastChild);
			}
		}
	}

	function dataBind(node, data, context, bindingStore, debugInfo) {
		if (node.nodeType == 1 && node.tagName != "TEMPLATE") {
			if (api.onDataBinding) api.onDataBinding(node);
			var dirs = getDirectives(node);
			if (dirs.repeater) {
				removeDirectives(node, dirs);
					var repeater = new Repeater(dirs.repeater.name, node, data, context, debugInfo);
					var prop = evalExpr(dirs.repeater.value, data, context, {}, debugInfo);
					var binding = new Binding(prop, 1);
					binding.onChange = function() {repeater.update(prop.get())};
					binding.onUnbind = function() {repeater.update(0)};
					binding.bind();
					bindingStore.bindings.push(binding);
			}
			else {
				while (dirs.view) {
					var viewName = dirs.view;
					if (!api.views[viewName]) {
						api.console.warn("View '" + viewName + "' is not ready");
						var repeater = new Repeater(null, node, data, context, debugInfo);
						var prop = evalExpr("#views['" + viewName + "']", api, null, {}, debugInfo);
						var binding = new Binding(prop, 1);
						binding.onChange = function() {repeater.update(prop.get() ? 1 : 0)};
						binding.onUnbind = function() {repeater.update(0)};
						binding.bind();
						bindingStore.bindings.push(binding);
						return;
					}
					var newNode = api.views[viewName].template.cloneNode(true);
					node.parentNode.replaceChild(newNode, node);
					node = newNode;
					var extendedData = null;
					for (var i=0; i<dirs.vars.length; i++) {
							if (!extendedData) extendedData = extend(data);
							var prop = evalExpr(dirs.vars[i].value, data, context, {thisElem: node}, debugInfo);
							bindParam(extendedData, dirs.vars[i].name, prop, bindingStore);
						}
					if (extendedData) data = extendedData;
					for (var i=0; i<dirs.statements.length; i++) {
							var prop = evalExpr(dirs.statements[i].value, data, context, {thisElem: node}, debugInfo);
							var binding = new Binding(prop, 2);
							binding.onChange = prop.get;
							binding.bind();
							bindingStore.bindings.push(binding);
						}
					for (var i=0; i<dirs.events.length; i++) {
							var scope = {thisElem: node, event: null};
							var prop = evalExpr(dirs.events[i].value, data, context, scope, debugInfo);
							makeEventHandler(node, dirs.events[i].name, scope, prop);
						}
					var newContext = new api.views[viewName].controller(node);
					for (var i=0; i<dirs.params.length; i++) {
							var prop = evalExpr(dirs.params[i].value, data, context, {thisElem: node}, debugInfo);
							bindParam(newContext, dirs.params[i].name, prop, bindingStore);
						}
					data = context = newContext;
					debugInfo = debugInfo.concat(viewName);
					if (api.onDataBinding) api.onDataBinding(node);
					dirs = getDirectives(node);
				}
				removeDirectives(node, dirs);
				var extendedData = null;
				for (var i=0; i<dirs.vars.length; i++) {
						if (!extendedData) extendedData = extend(data);
						var prop = evalExpr(dirs.vars[i].value, data, context, {thisElem: node}, debugInfo);
						bindParam(extendedData, dirs.vars[i].name, prop, bindingStore);
					}
				if (extendedData) data = extendedData;
				for (var i=0; i<dirs.statements.length; i++) {
						var prop = evalExpr(dirs.statements[i].value, data, context, {thisElem: node}, debugInfo);
						var binding = new Binding(prop, 2);
						binding.onChange = prop.get;
						binding.bind();
						bindingStore.bindings.push(binding);
					}
				for (var i=0; i<dirs.events.length; i++) {
						var scope = {thisElem: node, event: null};
						var prop = evalExpr(dirs.events[i].value, data, context, scope, debugInfo);
						makeEventHandler(node, dirs.events[i].name, scope, prop);
					}
				var child = node.firstChild;
				while (child) {
					var nextSibling = child.nextSibling;
					if (child.nodeType == 1 || child.nodeType == 3 && child.nodeValue.indexOf('{{') != -1) dataBind(child, data, context, bindingStore, debugInfo);
					child = nextSibling;
				}
			}
		}
		else if (node.nodeType == 3) {
			var prop = evalText(node.nodeValue, data, context, {thisElem: node}, debugInfo);
			if (prop) {
				var binding = new Binding(prop, 3);
				binding.onChange = function() {
					var textarea = document.createElement("textarea");
					textarea.innerHTML = prop.get();
					node.nodeValue = textarea.value;
				};
				binding.bind();
				bindingStore.bindings.push(binding);
			}
		}
	}

	function bindParam(data, paramName, prop, bindingStore) {
		if (prop.isExpr) {
			var binding = new Binding(prop, 0);
			binding.onChange = function() {data[paramName] = prop.get()};
			binding.bind();
			bindingStore.bindings.push(binding);
		}
		else setProp(data, paramName, prop);
	}

	/**
	 * API
	 */
	var api = {
		directives: {				//you can change the names of the binding directives by modifying this object
			bindView: "bind-view",
			bindParameter: "bind-param-",
			bindVariable: "bind-var-",
			bindStatement: "bind-statement-",
			bindEvent: "bind-event-",
			bindRepeater: "bind-repeater-"
		},
		views: {},					//declare your views, name->value where value={template: anHtmlTemplate, controller: function(rootElementOfView)}
		onDataBinding: null,		//set this to a function that will be called before each node is bound, you can use this to process custom directives
		autoBind: true,				//if true, automatically dataBind the entire document as soon as it is ready
		repeaterCacheTTL: 300000,	//removed repeater items are kept in a cache for reuse, the cache is cleared if it is not accessed within the TTL
		timerInterval: 30000,		//granularity of the internal timer
		evalExpr: evalExpr,			//process a binding expression and return a Property object
		evalText: evalText,			//process a string containing {{binding expression}}'s, return a Property object or null if there is none
		getProp: getProp,			//convert the specified object property to a getter-setter, return the underlying Property object
		setProp: setProp,			//set the given Property object as the underlying getter-setter for the specified object property
		Binding: Binding,
		BindingStore: BindingStore,
		dataBind: function(elem, context, bindingStore, debugInfo) {
			dataBind(elem, context, context, bindingStore||new BindingStore(), debugInfo||[]);
		},
		console: window.console || {log: noOp, warn: noOp}
	};

	function onReady() {
			if (api.autoBind) {
				api.console.log("Auto binding document, to disable auto binding set dataBinder.autoBind to false");
				var startTime = new Date().getTime();
				api.dataBind(document.body, window, null, ["document"]);
				api.console.log("Finished binding document", new Date().getTime()-startTime, "ms");
			}
	}

	if (!window.dataBinder) {
		window.dataBinder = api;
		if (window.jQuery) jQuery(onReady);
		else document.addEventListener("DOMContentLoaded", onReady, false);
	}
})();
