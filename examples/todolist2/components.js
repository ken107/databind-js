function Filters(elem, data) {
	this.setFilter = function(filter) {
		$(elem).triggerHandler('set-filter', filter);
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
		$(elem).triggerHandler('delete-item', item);
	}
	this.addItem = function(text) {
		$(elem).triggerHandler('add-item', text);
	}
	this.setCompleted = function(item, completed) {
		$(elem).triggerHandler('set-completed', {item: item, completed: completed});
	}
	this.setText = function(item, text) {
		$(elem).triggerHandler('set-text', {item, item, text: text});
	}
}

function TodoItem(elem, data) {
	this.deleteItem = function() {
		$(elem).triggerHandler('delete-item');
	}
	this.setCompleted = function(completed) {
		$(elem).triggerHandler('set-completed', completed);
	}
	this.setText = function(text) {
		$(elem).triggerHandler('set-text', text);
	}
	this.startEdit = function() {
		$(elem).triggerHandler('start-edit')
	}
	this.stopEdit = function() {
		$(elem).triggerHandler('stop-edit');
	}
}
