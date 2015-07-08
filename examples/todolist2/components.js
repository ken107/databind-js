function Filters(elem, data) {
	this.setFilter = function(filter) {
		$(elem).triggerHandler('setFilter', filter);
	}
}

function TodoList(elem, data) {
	data.filteredItems = null;
	data.currentFilter = 'All';
	data.editItem = null;
	data.countActive = null;
	this.update = function() {
		data.filteredItems = data.items.filter(function(item) {
			return data.currentFilter == 'All' ||
				data.currentFilter == 'Active' && !item.completed ||
				data.currentFilter == 'Completed' && !!item.completed;
		});
		data.countActive = data.items.filter(function(item) {
			return !item.completed;
		}).length;
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

function TodoItem(elem, data) {
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
