//controllers

function Filters(elem) {
	this.viewRoot = elem;
}

function TodoList(elem) {
	this.viewRoot = elem;
	this.filterItems = function(items, currentFilter) {
		return items.filter(function(item) {
			return currentFilter == 'All' ||
				currentFilter == 'Active' && !item.completed ||
				currentFilter == 'Completed' && !!item.completed;
		})
	}
	this.isAllCompleted = function(items) {
		return items.length && items.every(function(item) {return item.completed});
	}
	this.isSomeCompleted = function(items) {
		return items.some(function(item) {return item.completed});
	}
	this.countIncomplete = function(items) {
		return items.filter(function(item) {return !item.completed}).length;
	}
	this.addItem = function(text) {
		dispatchEvent(elem, 'addItem', text);
	}
}

function TodoItem(elem) {
	this.viewRoot = elem;
	this.setText = function(text) {
		dispatchEvent(elem, 'setText', text);
	}
	this.stopEdit = function() {
		dispatchEvent(elem, 'stopEdit');
	}
}


//helpers

function toggleClass(elem, className, toggle) {
	if (toggle) elem.className += " " + className;
	else elem.className = elem.className.replace(new RegExp("(?:^|\\s)" + className + "(?!\\S)", "g"), "");
}

function dispatchEvent(elem, type, data) {
	var event;
	try {
		event = new Event(type);
		event.bubbles = false;
	}
	catch (err) {
		event = document.createEvent('Event');
		event.initEvent(type, false, false);
	}
	event.data = data;
	elem.dispatchEvent(event);
}
