/**
 * DataBinder <https://github.com/ken107/databind-js>
 * Copyright 2015, Hai Phan <hai.phan@gmail.com>
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
(function() {
	const prefix = "{{"
	const suffix = "}}"
	const regex = {
		textBindExpr: new RegExp(prefix + "[\\s\\S]*?" + suffix ,"g"),
		singlePart: /^\s*parts\[0\].get\(\)\s*$/,
		bindingSource: /'.*?'|".*?"|#\w+(?:\.\w+|\[(?:.*?\[.*?\])*?[^\[]*?\])*(\s*(?:\+\+|--|\+=|-=|\*=|\/=|%=|=(?!=)|\())?/g,
		propertyAccessor: /\.\w+|\[(?:.*?\[.*?\])*?[^\[]*?\]/g,
		thisMethodCall: /\bthis\.(\w+)\s*\(/g,
		kebab: /-([a-z])/g,
		nonExpr: /;\s*\S/,
		allDigits: /^\d+$/,
	}
	const propPrefix = "__prop__"
	const exprCache = {}
	const varDependencyCache = new Map()
	const unreadyViews = new Set()

	/**
	 * Helpers
	 */
	function immediate(func) {
		return func()
	}

	const callLater = immediate(() => {
		let queue = null
		function call() {
			while (queue.min <= queue.max) {
				if (queue[queue.min]) {
					const funcs = queue[queue.min]
					queue[queue.min++] = null
					for (const func of funcs) func()
				} else {
					queue.min++
				}
			}
			queue = null
		}
		return function(func, priority) {
			if (!queue) {
				queue = {min: priority, max: priority};
				(window.queueMicrotask || setTimeout)(call)
			}
			(queue[priority] || (queue[priority] = new Set())).add(func)
			if (priority < queue.min) queue.min = priority
			if (priority > queue.max) queue.max = priority
		}
	})

	const timer = immediate(() => {
		let queue = null
		let counter = 0
		let intervalId = 0
		function onTimer() {
			const now = Date.now()
			for (const [id, {callback, expires}] of queue) {
				if (expires <= now) {
					callback()
					queue.delete(id)
				}
			}
			if (queue.size == 0) {
				queue = null;
				clearInterval(intervalId);
			}
		}
		return {
			callAfter(timeout, func) {
				if (!queue) {
					queue = new Map()
					intervalId = setInterval(onTimer, api.timerInterval);
				}
				const id = ++counter
				queue.set(id, {expires: Date.now()+timeout, callback: func})
				return id;
			},
			cancel(id) {
				if (queue) queue.delete(id)
			}
		}
	})

	function getDirectives(node) {
		const dirs = {params: [], vars: [], statements: [], events: [], toRemove: []}
		for (const attr of node.attributes) {
			if (attr.specified) {
				if (attr.name == api.directives.bindView) {
					dirs.view = attr.value;
					dirs.toRemove.push(attr.name);
				}
				else if (attr.name.startsWith(api.directives.bindParameter)) {
					dirs.params.push({
						name: toCamelCase(attr.name.slice(api.directives.bindParameter.length)),
						value: attr.value
					})
					dirs.toRemove.push(attr.name);
				}
				else if (attr.name.startsWith(api.directives.bindVariable)) {
					dirs.vars.push({
						name: toCamelCase(attr.name.slice(api.directives.bindVariable.length)),
						value: attr.value
					})
					dirs.toRemove.push(attr.name);
				}
				else if (attr.name.startsWith(api.directives.bindStatement)) {
					dirs.statements.push({
						value: "; " + attr.value
					})
					dirs.toRemove.push(attr.name);
				}
				else if (attr.name.startsWith(api.directives.bindEvent)) {
					dirs.events.push({
						name: attr.name.slice(api.directives.bindEvent.length),
						value: "; " + attr.value
					})
					dirs.toRemove.push(attr.name);
				}
				else if (attr.name.startsWith(api.directives.bindRepeater)) {
					dirs.repeater = {
						name: toCamelCase(attr.name.slice(api.directives.bindRepeater.length)),
						value: attr.value,
						view: node.getAttribute(api.directives.bindView)
					}
					dirs.toRemove = [attr.name];
					break;
				}
			}
		}
		if (dirs.vars.length > 1) {
			const cacheKey = dirs.vars.map(({ name, value }) => name + value).join('')
			let cacheValue = varDependencyCache.get(cacheKey)
			if (!cacheValue) varDependencyCache.set(cacheKey, cacheValue = sortByDependency(dirs.vars))
			dirs.vars = cacheValue
		}
		return dirs;
	}

	function sortByDependency(vars) {
		const input = vars.map(x => new RegExp('#' + x.name + '\\b'))
		const sorted = []
		while (sorted.length < input.length) {
			let i = input.length - 1
			while (i >= 0 && (!input[i] || vars.some((x, j) => input[j] && j != i && input[i].test(x.value)))) i--
			if (i < 0) {
				console.log(vars)
				throw new Error('Circular dependency detected')
			}
			sorted.unshift(vars[i])
			input[i] = null
		}
		return sorted
	}

	function removeDirectives(node, dirs) {
		for (const name of dirs.toRemove) node.removeAttribute(name)
	}

	function toCamelCase(str) {
		return str.replace(regex.kebab, g => g[1].toUpperCase())
	}

	function noOp() {
	}

	function illegalOp() {
		throw new Error("Illegal operation");
	}

	function printDebug(debugInfo) {
		if (debugInfo.length) console.log(debugInfo)
	}

	function proxy(func, ctx) {
		const args = Array.prototype.slice.call(arguments, 2)
		return function() {
			return func.apply(ctx, args.concat(Array.prototype.slice.call(arguments)));
		};
	}

	function makeEventHandler(node, type, scope, prop) {
		function handler(event) {
			scope.event = event;
			const val = prop.get()
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
		const camel = toCamelCase(type)
		if (window.jQuery) {
			jQuery(node).on(type, jQueryHandler);
			if (camel != type) jQuery(node).on(camel, jQueryHandler);
		}
		else {
			node.addEventListener(type, handler, false);
			if (camel != type) node.addEventListener(camel, handler, false);
		}
	}

	function randomString() {
		return Math.random().toString(36).slice(2)
	}

	function Property(value, onSubscribed) {
		const subscribers = new Map()
		let count = 0
		let keygen = 0
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
			subscribers.set(++keygen, subscriber)
			count++;
			return keygen;
		};
		this.unsubscribe = function(key) {
			if (!subscribers.delete(key)) throw new Error("Not subscribed")
			count--;
			if (!count && onSubscribed) onSubscribed(false);
		};
		this.publish = publish;
		function publish() {
			for (const subscriber of subscribers.values()) subscriber()
		};
		if (typeof rxjs != 'undefined') {
			this.value$ = rxjs.fromEventPattern(
				h => this.subscribe(() => h(this.get())),
				(h, k) => this.unsubscribe(k)
			).pipe(
				rxjs.startWith(this.get())
			)
		}
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
			Object.defineProperty(obj, propPrefix+name, {
				value: prop,
				writable: false,
				enumerable: false,
				configurable: false
			})
			Object.defineProperty(obj, name, {
				get: prop.get,
				set: prop.set,
				enumerable: true,
				configurable: false
			})
		} else {
			throw new Error("Not a Property object")
		}
	}

	function convertToProperty(obj, name) {
		const prop = new Property(obj[name])
		Object.defineProperty(obj, propPrefix+name, {
			value: prop,
			writable: false,
			enumerable: false,
			configurable: false
		})
		if (obj instanceof Array) {
			observeArray(obj);
			const isArrayIndex = regex.allDigits.test(name)
			if (!isArrayIndex || name < obj.length) {
				const desc = Object.getOwnPropertyDescriptor(obj, name)
				if (!desc || desc.configurable) {
					Object.defineProperty(obj, name, {
						get: prop.get,
						set: prop.set,
						enumerable: true,
						configurable: isArrayIndex
					})
				} else {
					if (name !== "length") {
						console.warn("Object", obj, "property '" + name + "' is not configurable, change may not be detected")
					}
					prop.get = fallbackGet;
					prop.set = fallbackSet;
				}
			}
		}
		else {
			const desc = Object.getOwnPropertyDescriptor(obj, name)
			if (!desc || desc.configurable) {
				Object.defineProperty(obj, name, {
					get: prop.get,
					set: prop.set,
					enumerable: true,
					configurable: false
				})
			} else {
				console.warn("Object", obj, "property '" + name + "' is not configurable, change may not be detected")
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
		const len = this.length
		const val = func.apply(this, Array.prototype.slice.call(arguments, 1))
		if (len != this.length) {
			const prop = this[propPrefix+"length"]
			if (prop) prop.publish();
		}
		for (let i=len; i<this.length; i++) {
			const prop = this[propPrefix+i]
			if (prop) {
				prop.set(this[i]);
				Object.defineProperty(this, i, {
					get: prop.get,
					set: prop.set,
					enumerable: true,
					configurable: true
				})
			}
		}
		for (let i=this.length; i<len; i++) {
			const prop = this[propPrefix+i]
			if (prop) prop.set(undefined);
		}
		return val;
	}

	/**
	 * Expression
	 */
	function parseExpr(str, debugInfo) {
		const funcs = []
		let match
		while (match = regex.thisMethodCall.exec(str)) funcs.push(match[1])
		const strings = []
		const parts = []
		const pmap = {}
		let expr = str.replace(regex.bindingSource, (bindingSrc, operator) => {
			if (bindingSrc.charAt(0) == "'" || bindingSrc.charAt(0) == '"') {
				strings.push(bindingSrc.slice(1, -1));
				return "strings[" + (strings.length-1) + "]";
			}
			else if (operator) {
				if (operator.slice(-1) == "(") {
					parts.push({bindingSrc: bindingSrc.slice(1, -operator.length)});
					return "(parts[" + (parts.length-1) + "].get() || noOp)" + operator;
				}
				else {
					parts.push({bindingSrc: bindingSrc.slice(1, -operator.length), operator: operator});
					return "parts[" + (parts.length-1) + "].value" + operator;
				}
			}
			else if (pmap[bindingSrc]) {
				return pmap[bindingSrc]
			}
			else {
				parts.push({bindingSrc: bindingSrc.slice(1)});
				return pmap[bindingSrc] = "parts[" + (parts.length-1) + "].get()";
			}
		});
		const isSinglePart = regex.singlePart.test(expr)
		if (!regex.nonExpr.test(expr)) expr = "return " + expr
		expr = "const thisElem = scope.thisElem, event = scope.event;\n" + expr;
		let func
		try {
			func = new Function("noOp", "scope", "strings", "parts", expr);
		} catch (err) {
			printDebug(debugInfo);
			throw err;
		}
		return { funcs, strings, parts, isSinglePart, func }
	}

	function evalExpr(str, data, context, scope, debugInfo) {
		debugInfo = debugInfo.concat(prefix + str + suffix);
		const c = exprCache[str] || (exprCache[str] = parseExpr(str, debugInfo))
		for (const func of c.funcs) {
			if (context[func] === undefined) {
				printDebug(debugInfo);
				throw new Error("Method '" + func + "' not found")
			}
		}
		const parts = []
		for (const {bindingSrc, operator} of c.parts) {
			const prop = evalBindingSrc(bindingSrc, data, context, scope, debugInfo)
			if (operator) {
				const part = {subscribe: noOp, unsubscribe: noOp}
				Object.defineProperty(part, "value", {
					get: prop.get,
					set: prop.set,
					enumerable: true,
					configurable: false
				})
				parts.push(part);
			} else {
				parts.push(prop)
			}
		}
		if (c.isSinglePart) return parts[0];

		const keys = new Array(parts.length)
		const prop = new Property(null, subscribed => {
			if (subscribed) {
				for (let i=0; i<parts.length; i++) subscribePart(parts[i], i)
			} else {
				for (let i=0; i<parts.length; i++) unsubscribePart(parts[i], i)
			}
		});
		prop.isExpr = true;
		prop.set = illegalOp;
		prop.get = function() {
			try {
				return c.func.call(context, noOp, scope, c.strings, parts);
			} catch (err) {
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
		const exprs = str.match(regex.textBindExpr)
		if (!exprs) return null;
		const parts = new Array(exprs.length)
		for (let i=0; i<exprs.length; i++) {
			parts[i] = evalExpr(exprs[i].slice(prefix.length, -suffix.length), data, context, scope, debugInfo)
		}

		const keys = new Array(parts.length)
		const prop = new Property(null, subscribed => {
			if (subscribed) {
				for (let i=0; i<parts.length; i++) subscribePart(parts[i], i)
			} else {
				for (let i=0; i<parts.length; i++) unsubscribePart(parts[i], i)
			}
		});
		prop.set = illegalOp;
		prop.get = function() {
			let i = 0
			return str.replace(regex.textBindExpr, () => {
				const val = parts[i++].get()
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
		const path = ("." + str).match(regex.propertyAccessor)
		const derefs = new Array(path.length)
		for (let i=0; i<path.length; i++) {
			if (path[i].charAt(0) === '.') {
				derefs[i] = path[i].slice(1)
			} else {
				derefs[i] = evalExpr(path[i].slice(1, -1), data, context, scope, debugInfo)
			}
		}
		const parts = new Array(path.length)
		parts[0] = getPropExt(data, derefs[0]);
		if (!parts[0]) {
			printDebug(debugInfo);
			throw new Error("Missing binding source for #" + str);
		}
		if (parts.length == 1) return parts[0];

		let curVal
		const derefKeys = new Array(path.length)
		const keys = new Array(path.length)
		let isSubscribed = false
		const prop = new Property(null, subscribed => {
			isSubscribed = subscribed;
			if (subscribed) {
				buildParts();
				for (let i=0; i<parts.length; i++) subscribePart(parts[i], i)
				for (let i=0; i<derefs.length; i++) subscribeDeref(derefs[i], i)
			} else {
				for (let i=0; i<parts.length; i++) unsubscribePart(parts[i], i)
				for (let i=0; i<derefs.length; i++) unsubscribeDeref(derefs[i], i)
			}
		});
		prop.set = function(newValue) {
			if (!isSubscribed) buildParts();
			const val = parts[parts.length-1]
			if (val instanceof Property) {
				val.set(newValue)
			} else {
				printDebug(debugInfo);
				throw new Error("Can't assign to #" + str + ", object is undefined");
			}
		};
		prop.get = function() {
			if (!isSubscribed) buildParts();
			if (curVal instanceof Function) {
				let ctx = context
				if (parts.length > 1) {
					ctx = parts[parts.length-2];
					if (ctx instanceof Property) ctx = ctx.get();
				}
				return function() {
					return curVal.apply(ctx, arguments);
				};
			} else {
				return curVal
			}
		};

		function evalPart(i) {
			const val = parts[i-1] instanceof Property ? parts[i-1].get() : parts[i-1]
			if (val instanceof Object) {
				const deref = derefs[i] instanceof Property ? derefs[i].get() : derefs[i]
				return getProp(val, deref);
			}
			else if (typeof val === "string") {
				const deref = derefs[i] instanceof Property ? derefs[i].get() : derefs[i]
				return val[deref];
			}
			else {
				return undefined
			}
		}
		function buildParts() {
			for (let i=1; i<parts.length; i++) parts[i] = evalPart(i)
			curVal = parts[parts.length-1] instanceof Property ? parts[parts.length-1].get() : parts[parts.length-1];
		}
		function rebuildPartsFrom(index) {
			for (let i=index; i<parts.length; i++) {
				const val = evalPart(i)
				if (val !== parts[i]) {
					unsubscribePart(parts[i], i);
					parts[i] = val;
					subscribePart(val, i);
				}
				else {
					//if new part is same as old part, then consider the binding's value UNCHANGED, unless
					//this part is the last part and is a function, then consider it CHANGED (because
					//even though it is the same function, it will be executed in a different context)
					if (val instanceof Function && i == parts.length-1) return true;
					else return false;
				}
			}
			//if we get here, it means the last part itself has been rebuilt, so we just re-eval the
			//last part to determine if the binding's value has changed. If the last part evals to a
			//function, we always consider it CHANGED (for the reason explained previously)
			const oldVal = curVal
			curVal = parts[parts.length-1] instanceof Property ? parts[parts.length-1].get() : parts[parts.length-1];
			return curVal !== oldVal || curVal instanceof Function;
		}
		function subscribePart(part, i) {
			if (part instanceof Property) {
				keys[i] = part.subscribe(() => {
					if (rebuildPartsFrom(i+1)) prop.publish();
				});
			}
		}
		function subscribeDeref(deref, i) {
			if (deref instanceof Property) {
				derefKeys[i] = deref.subscribe(() => {
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
	function makeBinding(prop, priority, onChange, onUnbind) {
		let subkey = null
		function notifyChange() {
			if (subkey) onChange()
		}
		return {
			bind() {
				if (subkey) throw new Error("Already bound");
				subkey = prop.subscribe(() => callLater(notifyChange, priority))
				onChange()
			},
			unbind() {
				if (subkey) {
					prop.unsubscribe(subkey);
					subkey = null;
					if (onUnbind) onUnbind()
				}
			},
			isBound() {
				return Boolean(subkey);
			}
		}
	}

	function makeBindingStore() {
		const bindings = []
		return {
			add(b) {
				bindings.push(b)
			},
			unbind() {
				for (const b of bindings) b.unbind()
			},
			rebind() {
				for (const b of bindings) b.bind()
			}
		}
	}

	function makeRepeater(name, node, data, context, debugInfo, depth) {
		const isReverse = node.hasAttribute("data-reverse")
		if (isReverse) node.removeAttribute("data-reverse");
		const parent = node.parentNode
		const tail = isReverse ? node.previousSibling : node.nextSibling
		parent.removeChild(node);
		let count = 0
		const bindingStores = []
		const cache = document.createDocumentFragment()
		let cacheTimeout = null

		return {
			update(newCount) {
				newCount = Number(newCount);
				if (isNaN(newCount) || newCount < 0) newCount = 0;
				if (newCount > count) {
					const newElems = document.createDocumentFragment()
					for (let i=count; i<newCount; i++) {
						if (cache.firstChild) {
							if (isReverse) newElems.insertBefore(cache.firstChild, newElems.firstChild);
							else newElems.appendChild(cache.firstChild);
							bindingStores[i].rebind();
						}
						else {
							const newElem = node.cloneNode(true)
							if (isReverse) newElems.insertBefore(newElem, newElems.firstChild);
							else newElems.appendChild(newElem);
							let newData = data
							if (name) {
								newData = extend(data);
								setProp(newData, name, new Property(i));
							}
							const bindingStore = makeBindingStore()
							bindingStores.push(bindingStore);
							dataBind(newElem, newData, context, bindingStore, debugInfo, depth);
						}
					}
					if (isReverse) parent.insertBefore(newElems, tail ? tail.nextSibling : parent.firstChild);
					else parent.insertBefore(newElems, tail);
				}
				else if (newCount < count) {
					let elem = tail ? (isReverse ? tail.nextSibling : tail.previousSibling) : (isReverse ? parent.firstChild : parent.lastChild)
					for (let i=count-1; i>=newCount; i--) {
						const prevElem = isReverse ? elem.nextSibling : elem.previousSibling
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
			}
		}

		function clearCache() {
			while (cache.lastChild) {
				bindingStores.pop();
				if (window.jQuery) jQuery(cache.lastChild).remove();
				else cache.removeChild(cache.lastChild);
			}
		}
	}

	function dataBind(node, data, context, bindingStore, debugInfo, depth) {
		if (node.nodeType == 1 && !["SCRIPT", "STYLE", "TEMPLATE"].includes(node.tagName)) {
			if (api.onDataBinding) api.onDataBinding(node);
			let dirs = getDirectives(node)
			if (dirs.repeater) {
				removeDirectives(node, dirs);
				const repeater = makeRepeater(dirs.repeater.name, node, data, context, debugInfo, depth + 1)
				let expr
				if (dirs.repeater.view && !api.views[dirs.repeater.view]) {
					unreadyViews.add(dirs.repeater.view)
					const name = randomString()
					setProp(data, name, getProp(api.views, dirs.repeater.view))
					expr = "!#" + name + " ? 0 : " + dirs.repeater.value
				} else {
					expr = dirs.repeater.value
				}
				const prop = evalExpr(expr, data, context, {}, debugInfo)
				const binding = makeBinding(prop, depth, () => repeater.update(prop.get()), () => repeater.update(0))
				binding.bind();
				bindingStore.add(binding)
			}
			else {
				while (dirs.view) {
					const viewName = dirs.view
					if (!api.views[viewName]) {
						unreadyViews.add(viewName)
						const repeater = makeRepeater(null, node, data, context, debugInfo, depth + 1)
						const prop = evalExpr("#views['" + viewName + "']", api, null, {}, debugInfo)
						const binding = makeBinding(prop, depth, () => repeater.update(prop.get() ? 1 : 0), () => repeater.update(0))
						binding.bind();
						bindingStore.add(binding)
						return;
					}
					const newNode = api.views[viewName].template.cloneNode(true)
					if (node.className) {
						newNode.className = newNode.className ? (newNode.className + " " + node.className) : node.className
					}
					for (let i=0; i<node.style.length; i++) {
						const prop = node.style.item(i)
						newNode.style[prop] = node.style[prop]
					}
					node.parentNode.replaceChild(newNode, node);
					node = newNode;
					bindingStore.add({
						bind() {},
						unbind() {
							if (window.jQuery) jQuery(node).triggerHandler("unmount")
							else node.dispatchEvent(new Event("unmount"))
						}
					})
					let extendedData = null
					for (const {name, value} of dirs.vars) {
						if (!extendedData) extendedData = extend(data);
						const prop = evalExpr(value, extendedData, context, {thisElem: node}, debugInfo)
						bindParam(extendedData, name, prop, bindingStore, depth)
					}
					if (extendedData) data = extendedData;
					for (const {value} of dirs.statements) {
						const prop = evalExpr(value, data, context, {thisElem: node}, debugInfo)
						const binding = makeBinding(prop, depth + 1, prop.get)
						binding.bind();
						bindingStore.add(binding)
					}
					for (const {name, value} of dirs.events) {
						const scope = {thisElem: node, event: null}
						const prop = evalExpr(value, data, context, scope, debugInfo)
						makeEventHandler(node, name, scope, prop)
					}
					const newContext = new api.views[viewName].controller(node)
					for (const {name, value} of dirs.params) {
						const prop = evalExpr(value, data, context, {thisElem: node}, debugInfo)
						bindParam(newContext, name, prop, bindingStore, depth + 1)
					}
					data = context = newContext;
					debugInfo = debugInfo.concat(viewName);
					if (api.onDataBinding) api.onDataBinding(node);
					dirs = getDirectives(node);
					depth += 2
				}
				removeDirectives(node, dirs);
				let extendedData = null
				for (const {name, value} of dirs.vars) {
					if (!extendedData) extendedData = extend(data);
					const prop = evalExpr(value, extendedData, context, {thisElem: node}, debugInfo)
					bindParam(extendedData, name, prop, bindingStore, depth)
				}
				if (extendedData) data = extendedData;
				for (const {value} of dirs.statements) {
					const prop = evalExpr(value, data, context, {thisElem: node}, debugInfo)
					const binding = makeBinding(prop, depth + 1, prop.get)
					binding.bind();
					bindingStore.add(binding)
				}
				for (const {name, value} of dirs.events) {
					const scope = {thisElem: node, event: null}
					const prop = evalExpr(value, data, context, scope, debugInfo)
					makeEventHandler(node, name, scope, prop)
				}
				let child = node.firstChild
				while (child) {
					const nextSibling = child.nextSibling
					if (child.nodeType == 1 || child.nodeType == 3 && child.nodeValue.indexOf(prefix) != -1) {
						dataBind(child, data, context, bindingStore, debugInfo, depth + 2);
					}
					child = nextSibling;
				}
			}
		}
		else if (node.nodeType == 3) {
			const prop = evalText(node.nodeValue, data, context, {thisElem: node}, debugInfo)
			if (prop) {
				const binding = makeBinding(prop, depth, () => {
					const textarea = document.createElement("textarea")
					textarea.innerHTML = prop.get();
					node.nodeValue = textarea.value;
				})
				binding.bind();
				bindingStore.add(binding)
			}
		}
	}

	function bindParam(data, paramName, prop, bindingStore, depth) {
		if (prop.isExpr) {
			const binding = makeBinding(prop, depth, () => data[paramName] = prop.get())
			binding.bind();
			bindingStore.add(binding)
		} else {
			setProp(data, paramName, prop)
		}
	}

	/**
	 * API
	 */
	const api = {
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

		/**
		 * Process a binding expression and return a _proxy_ representing its value
		 * @param {string} str A binding expression
		 * @param {object} data Binding sources
		 * @param {object} context Value of `this`
		 * @param {object} scope Local variables
		 * @param {array} debugInfo Debug info to accompany error messages
		 * @returns {PropertyProxy} A proxy object with methods for change subscription
		 */
		evalExpr(str, data, context = {}, scope = {}, debugInfo = []) {
			return evalExpr(str, data, context, scope, debugInfo)
		},

		/**
		 * Process a string containing zero or more binding expressions enclosed in double brackets,
		 * return a _proxy_ representing its interpolated value
		 * @param {string} str String containing binding expressions
		 * @param {object} data Binding sources
		 * @param {object} context Value of `this`
		 * @param {object} scope Local variables
		 * @param {array} debugInfo Debug info to accompany error messages
		 * @returns {PropertyProxy} A proxy object with methods for change subscription
		 */
		evalText(str, data, context = {}, scope = {}, debugInfo = []) {
			return evalText(str, data, context, scope, debugInfo)
		},

		/**
		 * Get the proxy for the specified object's property, which has methods for mutation and change subscription
		 * @param {object} obj An object
		 * @param {string} prop The property name
		 * @returns {PropertyProxy} The proxy
		 */
		getPropertyProxy(obj, prop) {
			return getProp(obj, prop)
		},

		/**
		 * Set the given proxy as the _backing_ for the specified object's property.
		 * This allows binding this property's value to the value of another object's property (using `getPropertyProxy`),
		 * or to the dynamic value of an expression (using `evalExpr` or `evalText`)
		 * @param {object} obj An object
		 * @param {string} prop The property name
		 * @param {PropertyProxy} proxy The proxy
		 */
		setPropertyProxy(obj, prop, proxy) {
			return setProp(obj, prop, proxy)
		},

		/**
		 * Process binding directives on a DOM tree
		 * @param {HTMLElement} elem The root DOM element (the View)
		 * @param {object} context An object that acts as both ViewModel (whose properties can be bound with `#`) and ViewController (whose methods can be invoked via `this`)
		 * @param {array} debugInfo The element's path, included in console error logs
		 * @returns A binding-store with two methods `unbind()` and `rebind()`
		 */
		dataBind(elem, context, debugInfo) {
			const bindingStore = makeBindingStore()
			dataBind(elem, context, context, bindingStore, debugInfo||[], 0)
			return bindingStore
		},

		getMissingViews() {
			return [...unreadyViews].filter(x => !api.views[x])
		},
	};

	function onReady() {
		if (api.autoBind) {
			console.log("Auto binding document, to disable auto binding set dataBinder.autoBind to false")
			const startTime = Date.now()
			api.dataBind(document.body, window, null, ["document"]);
			console.log("Finished binding document", Date.now()-startTime, "ms")
			setTimeout(() => {
				const missing = api.getMissingViews()
				if (missing.length) console.warn("Missing views", missing)
			}, 3000)
		}
	}

	if (!window.dataBinder) {
		window.dataBinder = api;
		if (window.jQuery) jQuery(onReady);
		else document.addEventListener("DOMContentLoaded", onReady, false);
	}
})();
