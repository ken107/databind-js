function Filters(elem) {
	this.setFilter = function(filter) {
		$(elem).triggerHandler('setFilter', filter);
	}
}

function TodoList(elem) {
	this.filteredItems = null;
	this.currentFilter = 'All';
	this.editItem = null;
	this.countActive = null;
	this.update = function() {
		var self = this;
		this.filteredItems = this.items.filter(function(item) {
			return self.currentFilter == 'All' ||
				self.currentFilter == 'Active' && !item.completed ||
				self.currentFilter == 'Completed' && !!item.completed;
		});
		this.countActive = this.items.filter(function(item) {
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
