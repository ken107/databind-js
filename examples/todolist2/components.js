//controllers

function Filters() {
}

function TodoList() {
	this.isItemVisible = function(isCompleted, currentFilter) {
		return currentFilter == 'All' ||
			currentFilter == 'Active' && !isCompleted ||
			currentFilter == 'Completed' && isCompleted;
	};
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
