function Filters(elem) {
	this.setFilter = function(filter) {
		$(elem).triggerHandler('setFilter', filter);
	}
}

function TodoList(elem) {
	this.currentFilter = 'All';
	this.editItem = null;
	this.updateFlag = 0;
	this.filterFunc = function(item) {
		return this.currentFilter == 'All' ||
			this.currentFilter == 'Active' && !item.completed ||
			this.currentFilter == 'Completed' && !!item.completed;
	}
	this.deleteItem = function(item) {
		$(elem).triggerHandler('deleteItem', item);
	}
	this.addItem = function(text) {
		$(elem).triggerHandler('addItem', text);
	}
	this.setCompleted = function(item, completed) {
		$(elem).triggerHandler('setCompleted', {item: item, completed: completed});
	}
	this.setText = function(item, text) {
		$(elem).triggerHandler('setText', {item, item, text: text});
	}
}

function TodoItem(elem) {
	this.deleteItem = function() {
		$(elem).triggerHandler('deleteItem');
	}
	this.setCompleted = function(completed) {
		$(elem).triggerHandler('setCompleted', completed);
	}
	this.setText = function(text) {
		$(elem).triggerHandler('setText', text);
	}
	this.startEdit = function() {
		$(elem).triggerHandler('startEdit')
	}
	this.stopEdit = function() {
		$(elem).triggerHandler('stopEdit');
	}
}
