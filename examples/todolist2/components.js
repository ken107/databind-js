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
		$(elem).triggerHandler('addItem', text);
	}
}

function TodoItem(elem) {
	this.viewRoot = elem;
	this.setText = function(text) {
		$(elem).triggerHandler('setText', text);
	}
	this.stopEdit = function() {
		$(elem).triggerHandler('stopEdit');
	}
}
