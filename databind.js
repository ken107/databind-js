
(function($) {
	var regex = [
		/{{.*?}}/g,
		/^\s*parts\[0\].get\(\)\s*$/,
		/'.*?'|".*?"|#\w+(?:\.\w+|\[(?:.*?\[.*?\])*?[^\[]*?\])*/g,
		/\.\w+|\[(?:.*?\[.*?\])*?[^\[]*?\]/g,
		/\bthis\.(\w+)\s*\(/g,
		/-([a-z])/g,
		/;\s*\S|^\s*if\b/
	];
	
	var directives = {
		bindTemplate: "bind-template",
		bindContext: "bind-context",
		bindParameter: "bind-param-",
		bindStatement: "bind-statement-",
		bindEvent: "bind-event-",
		bindRepeater: "bind-repeater-"
	};
	
	var propPrefix = "__prop__";
	var exprCache = {};
	
	/**
	 * Helpers
	 */
	var callLater = (function() {
		var queue = null;
		function call() {
			var funcs = queue;
			queue = null;
			for (var i=0; i<funcs.length; i++) funcs[i].called = false;
			for (var i=0; i<funcs.length; i++) if (!funcs[i].called) {
				funcs[i]();
				funcs[i].called = true;
			}
		}
		return function(func) {
			if (!queue) {
				queue = [];
				setTimeout(call, 0);
			}
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
	
	function getAttrs(node) {
		var attrs = {};
		for (var i=0; i<node.attributes.length; i++) {
			var attr = node.attributes[i];
			if (attr.specified) attrs[attr.name] = attr.value;
		}
		return attrs;
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
		if (window.console && debugInfo.length) console.log(debugInfo);
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
		function Wrapper() {}
		Wrapper.prototype = data;
		return Object.defineProperty(new Wrapper(), "__extends__", {value: data, writable: false, enumerable: false, configurable: false});
	}
	
	function getProp(obj, name, onlyIfExist) {
		if (obj[propPrefix+name]) return obj[propPrefix+name];
		else if (obj.__extends__) return obj.hasOwnProperty(name) ? convertToProperty(obj, name) : getProp(obj.__extends__, name, onlyIfExist);
		else return onlyIfExist && !(name in obj) ? null : convertToProperty(obj, name);
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
			prop.get = function() {return obj[name];};
			prop.set = function(newValue) {if (newValue !== obj[name]) {obj[name] = newValue; prop.publish();}};
		}
		else {
			var desc = Object.getOwnPropertyDescriptor(obj, name);
			if (!desc || desc.configurable) Object.defineProperty(obj, name, {get: prop.get, set: prop.set, enumerable: true, configurable: false});
			else {
				if (window.console) console.warn("Object", obj, "property '" + name + "' is not configurable, change may not be detected");
				prop.get = function() {return obj[name];};
				prop.set = function(newValue) {if (newValue !== obj[name]) {obj[name] = newValue; prop.publish();}};
			}
		}
		return prop;
	}
	
	function notifyArrayChange(arr, index, howMany) {
		var start = index || 0;
		var end = howMany ? start+howMany : arr.length;
		for (var i=start; i<end; i++) if (arr[propPrefix+i]) arr[propPrefix+i].publish();
		if (end >= arr.length && arr[propPrefix+"length"]) arr[propPrefix+"length"].publish();
	}
	
	/**
	 * Expression
	 */
	function evalExpr(str, data, context, scope, debugInfo) {
		debugInfo = debugInfo.concat("{{" + str + "}}");
		var match;
		while (match = regex[4].exec(str)) {
			if (context[match[1]] === undefined) {
				printDebug(debugInfo);
				throw new Error("Method '" + match[1] + "' not found");
			}
		}
		var strings = [];
		var parts = [];
		var pmap = {};
		var expr = str.replace(regex[2], function(bindingSrc) {
			if (bindingSrc.charAt(0) === "'" || bindingSrc.charAt(0) === '"') {
				strings.push(bindingSrc.substr(1, bindingSrc.length-2));
				return "strings[" + (strings.length-1) + "]";
			}
			else if (pmap[bindingSrc]) return pmap[bindingSrc];
			else {
				parts.push(evalBindingSrc(bindingSrc.substr(1), data, context, scope, debugInfo));
				return pmap[bindingSrc] = "parts[" + (parts.length-1) + "].get()";
			}
		});
		if (regex[1].test(expr)) return parts[0];
		if (!regex[6].test(expr)) expr = "return " + expr;
		if (scope) for (var i in scope) expr = "var " + i + " = scope." + i + ";\n" + expr;
		var func;
		try {
			func = exprCache[expr] || (exprCache[expr] = new Function("data", "scope", "strings", "parts", expr));
		}
		catch (err) {
			printDebug(debugInfo);
			throw err;
		}
		
		var keys = new Array(parts.length);
		var prop = new Property(null, function(subscribed) {
			if (subscribed) for (var i=0; i<parts.length; i++) subscribePart(parts[i], i);
			else for (var i=0; i<parts.length; i++) unsubscribePart(parts[i], i);
		});
		prop.set = illegalOp;
		prop.get = function() {
			try {
				return func.call(context, data, scope, strings, parts);
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
		parts[0] = getProp(data, derefs[0], true);
		if (!parts[0]) {
			printDebug(debugInfo);
			throw new Error("Missing binding source for #" + str);
		}
		if (parts.length == 1) return parts[0];
		
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
			var val = parts[parts.length-1];
			if (val instanceof Property) val = val.get();
			if (val instanceof Function) {
				var ctx = data;
				if (parts.length > 1) {
					ctx = parts[parts.length-2];
					if (ctx instanceof Property) ctx = ctx.get();
				}
				return function() {
					return val.apply(ctx, arguments);
				};
			}
			else return val;
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
		}
		function rebuildPartsFrom(index) {
			for (var i=index; i<parts.length; i++) {
				var val = evalPart(i);
				if (val !== parts[i]) {
					unsubscribePart(parts[i], i);
					parts[i] = val;
					subscribePart(val, i);
				}
			}
		}
		function subscribePart(part, i) {
			if (part instanceof Property) {
				keys[i] = part.subscribe(function() {
					rebuildPartsFrom(i+1);
					prop.publish();
				});
			}
		}
		function subscribeDeref(deref, i) {
			if (deref instanceof Property) {
				derefKeys[i] = deref.subscribe(function() {
					rebuildPartsFrom(i);
					prop.publish();
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
	function Binding(expr, prop, onChange, onUnbind) {
		var subkey = null;
		function notifyChange() {
			if (subkey) onChange();
		}
		this.expr = expr;
		this.bind = function() {
			if (subkey) throw new Error("Already bound");
			subkey = prop.subscribe(function() {
				callLater(notifyChange);
			});
			onChange();
		};
		this.unbind = function() {
			if (subkey) {
				prop.unsubscribe(subkey);
				subkey = null;
				if (onUnbind) onUnbind();
			}
		};
		this.isBound = function() {
			return Boolean(subkey);
		};
	}
	
	var getBindingStore = (function(cache, counter) {
		return function(elem, create) {
			var id = elem.getAttribute("data-binder-bindings");
			if (!id && create) {
				elem.setAttribute("data-binder-bindings", id = ++counter);
				cache[id] = {
					bindings: [],
					unbind: function() {
						for (var i=0; i<this.bindings.length; i++) this.bindings[i].unbind();
					},
					rebind: function() {
						for (var i=0; i<this.bindings.length; i++) this.bindings[i].bind();
					},
					remove: function() {
						delete cache[id];
						elem.removeAttribute("data-binder-bindings");
					}
				};
			}
			return id ? cache[id] : null;
		};
	})({}, 0);
	
	function Repeater(name, node, data, context, debugInfo) {
		var parent = node.parentNode;
		var tail = node.nextSibling;
		parent.removeChild(node);
		var count = 0;
		var cache = document.createDocumentFragment();
		var cacheTimeout = null;
		this.update = function(newCount) {
			newCount = Number(newCount);
			if (isNaN(newCount) || newCount < 0) newCount = 0;
			if (newCount > count) {
				var newElems = document.createDocumentFragment();
				for (var i=count; i<newCount; i++) {
					if (cache.lastChild) {
						getBindingStore(cache.lastChild).rebind();
						newElems.appendChild(cache.lastChild);
					}
					else {
						var newElem = node.cloneNode(true);
						newElems.appendChild(newElem);
						var newData = extend(data);
						setProp(newData, name, new Property(i));
						dataBind(newElem, newData, context, getBindingStore(newElem, true), debugInfo);
					}
				}
				parent.insertBefore(newElems, tail);
			}
			else if (newCount < count) {
				var elem = tail ? tail.previousSibling : parent.lastChild;
				for (var i=newCount; i<count; i++) {
					var prevElem = elem.previousSibling;
					getBindingStore(elem).unbind();
					cache.appendChild(elem);
					elem = prevElem;
				}
			}
			count = newCount;
			if (cacheTimeout) {
				timer.cancel(cacheTimeout);
				cacheTimeout = null;
			}
			if (cache.lastChild && api.repeaterCacheTTL) {
				cacheTimeout = timer.callAfter(api.repeaterCacheTTL, clearCache);
			}
		};
		function clearCache() {
			while (cache.lastChild) {
				getBindingStore(cache.lastChild).remove();
				$(cache.lastChild).remove();
			}
		}
	}
	
	function dataBind(node, data, context, bindingStore, debugInfo) {
		if (node.nodeType == 1) {
			if (api.onDataBinding) api.onDataBinding(node);
			var attrs = getAttrs(node);
			var isRepeater = false;
			for (var attrName in attrs) {
				var attrValue = attrs[attrName];
				if (attrName.lastIndexOf(directives.bindRepeater, 0) === 0) {
					isRepeater = true;
					node.removeAttribute(attrName);
					var repeater = new Repeater(toCamelCase(attrName.substr(directives.bindRepeater.length)), node, data, context, debugInfo);
					var prop = evalExpr(attrValue, data, context, null, debugInfo);
					var binding = new Binding(attrValue, prop, function() {
						repeater.update(prop.get());
					},
					function() {
						repeater.update(0);
					});
					binding.bind();
					bindingStore.bindings.push(binding);
				}
			}
			if (!isRepeater) {
				var extendedData = null;
				if (attrs[directives.bindTemplate]) {
					var templateName = attrs[directives.bindTemplate];
					if (!api.templates[templateName]) {
						printDebug(debugInfo);
						throw new Error("Template not found (" + templateName + ")");
					}
					var newNode = api.templates[templateName].cloneNode(true);
					node.parentNode.replaceChild(newNode, node);
					node = newNode;
					if (!api.templateInheritsData) extendedData = {};
					if (attrs[directives.bindContext]) {
						var prop = evalExpr(attrs[directives.bindContext], data, context, {thisElem: node}, debugInfo);
						context = prop.get();
					}
					for (var attrName in attrs) {
						var attrValue = attrs[attrName];
						if (attrName.lastIndexOf(directives.bindParameter, 0) === 0) {
							if (!extendedData) extendedData = extend(data);
							setProp(extendedData, toCamelCase(attrName.substr(directives.bindParameter.length)), evalExpr(attrValue, data, context, {thisElem: node}, debugInfo));
						}
						else if (attrName.lastIndexOf(directives.bindStatement, 0) === 0) {
							var prop = evalExpr(attrValue, data, context, {thisElem: node}, debugInfo);
							var binding = new Binding(attrValue, prop, prop.get);
							binding.bind();
							bindingStore.bindings.push(binding);
						}
						else if (attrName.lastIndexOf(directives.bindEvent, 0) === 0) {
							var scope = {thisElem: node, event: null};
							var prop = evalExpr(attrValue, data, context, scope, debugInfo);
							$(node).on(attrName.substr(directives.bindEvent.length), [scope, prop], function(event) {
								var scope = event.data[0];
								var prop = event.data[1];
								event.data = arguments.length > 2 ? Array.prototype.slice.call(arguments, 1) : arguments[1];
								scope.event = event;
								return prop.get();
							});
						}
					}
					if (extendedData) {
						data = extendedData;
						extendedData = null;
					}
					debugInfo = debugInfo.concat(templateName);
					if (api.onDataBinding) api.onDataBinding(node);
					attrs = getAttrs(node);
				}
				if (attrs[directives.bindContext]) {
					node.removeAttribute(directives.bindContext);
					var prop = evalExpr(attrs[directives.bindContext], data, context, {thisElem: node}, debugInfo);
					context = prop.get();
				}
				for (var attrName in attrs) {
					var attrValue = attrs[attrName];
					if (attrName.lastIndexOf(directives.bindParameter, 0) === 0) {
						node.removeAttribute(attrName);
						if (!extendedData) extendedData = extend(data);
						setProp(extendedData, toCamelCase(attrName.substr(directives.bindParameter.length)), evalExpr(attrValue, data, context, {thisElem: node}, debugInfo));
					}
					else if (attrName.lastIndexOf(directives.bindStatement, 0) === 0) {
						node.removeAttribute(attrName);
						var prop = evalExpr(attrValue, data, context, {thisElem: node}, debugInfo);
						var binding = new Binding(attrValue, prop, prop.get);
						binding.bind();
						bindingStore.bindings.push(binding);
					}
					else if (attrName.lastIndexOf(directives.bindEvent, 0) === 0) {
						node.removeAttribute(attrName);
						var scope = {thisElem: node, event: null};
						var prop = evalExpr(attrValue, data, context, scope, debugInfo);
						$(node).on(attrName.substr(directives.bindEvent.length), [scope, prop], function(event) {
							var scope = event.data[0];
							var prop = event.data[1];
							event.data = arguments.length > 2 ? Array.prototype.slice.call(arguments, 1) : arguments[1];
							scope.event = event;
							return prop.get();
						});
					}
				}
				var child = node.firstChild;
				while (child) {
					var nextSibling = child.nextSibling;
					if (child.nodeType == 1 || child.nodeType == 3 && child.nodeValue.indexOf('{{') != -1) dataBind(child, extendedData||data, context, bindingStore, debugInfo);
					child = nextSibling;
				}
			}
		}
		else if (node.nodeType == 3) {
			var prop = evalText(node.nodeValue, data, context, {thisElem: node}, debugInfo);
			if (prop) {
				var binding = new Binding(node.nodeValue, prop, function() {
					node.nodeValue = $('<textarea/>').html(prop.get()).val();
				});
				binding.bind();
				bindingStore.bindings.push(binding);
			}
		}
	}
	
	function listBindings(elem, recursive, level) {
		if (!level) level = 0;
		var indent = new Array(level+1).join(" ");
		var bindingStore = dataBinder.getBindingStore(elem);
		if (bindingStore) {
			var bindings = bindingStore.bindings;
			for (var i=0; i<bindings.length; i++) console.log(indent, elem.nodeName, bindings[i].isBound(), bindings[i].expr.replace(/\n/g, "\\n"));
		}
		else console.log(indent, elem.nodeName);
		if (recursive) {
			elem = elem.firstChild;
			while (elem) {
				if (elem.nodeType == 1) listBindings(elem, recursive, level+1);
				elem = elem.nextSibling;
			}
		}
	}
	
	/**
	 * API
	 */
	var api = window.dataBinder = {
		directives: directives,		//you can change the names of the binding directives by modifying this object
		templates: {},				//populate this field with your templates, may need to turn off autoBind and turn it back on after templates finish loading
		onDataBinding: null,		//set this to a function that will be called before each node is bound, you can use this to process custom directives
		autoBind: true,				//if true, automatically dataBind the entire document as soon as it is ready
		templateInheritsData: true,	//if false, template will inherit no data from parent, any data must be passed in using bind-param
		repeaterCacheTTL: 300000,	//removed repeater items are kept in a cache for reuse, the cache is cleared if it is not accessed within the TTL
		timerInterval: 30000,		//granularity of the internal timer
		evalExpr: evalExpr,			//process a binding expression and return a Property object
		evalText: evalText,			//process a string containing {{binding expression}}'s, return a Property object or null if there is none
		getProp: getProp,			//convert the specified object property to a getter-setter, return the underlying Property object
		setProp: setProp,			//set the given Property object as the underlying getter-setter for the specified object property
		notifyArrayChange: notifyArrayChange,
		Binding: Binding,
		getBindingStore: getBindingStore,	//return an element's binding store
		listBindings: listBindings,			//dump an element's binding store to the console
		dataBind: dataBind
	};
	
	$.fn.dataBind = function(data, context, debugInfo) {
		return this.each(function() {
			dataBind(this, data, context, getBindingStore(this, true), debugInfo||[]);
		});
	};
	
	$(document).ready(function() {
		var prop = getProp(api, "autoBind");
		var binding = new Binding("autoBind", prop, function() {
			if (prop.get()) {
				binding.unbind();
				if (window.console) console.log("Auto binding document, to disable auto binding set dataBinder.autoBind to false");
				var startTime = new Date().getTime();
				$(document.body).dataBind(window, window, ["document"]);
				if (window.console) console.log("Finished binding document", new Date().getTime()-startTime, "ms");
			}
		});
		binding.bind();
	});
})
(jQuery);
