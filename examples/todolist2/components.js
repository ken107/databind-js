//controllers

function Filters() {
}

function TodoList() {
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
}

function TodoItem() {
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
