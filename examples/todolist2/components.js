function Filters(elem, data) {
	this.setFilter = function(filter) {
		$(elem).triggerHandler('set-filter', filter);
	}
}

function TodoList(elem, data) {
	this.deleteItem = function(item) {
		$(elem).triggerHandler('delete-item', item);
	}
	this.addItem = function(text) {
		$(elem).triggerHandler('add-item', text);
	}
	this.setCompleted = function(item, completed) {
		$(elem).triggerHandler('set-completed', {item: item, completed: completed});
	}
}

function TodoItem(elem, data) {
	this.deleteItem = function() {
		$(elem).triggerHandler('delete-item');
	}
	this.setCompleted = function(completed) {
		$(elem).triggerHandler('set-completed', completed);
	}
	this.startEdit = function() {
		$(elem).triggerHandler('start-edit')
	}
	this.stopEdit = function() {
		$(elem).triggerHandler('stop-edit');
	}
}
