function TodoList(data) {
	this.addItem = function(text) {
		data.items.push({text: text});
		data.updateFlag++;
	};
	this.deleteItem = function(item) {
		data.items.splice(data.items.indexOf(item), 1);
		data.updateFlag++;
	};
	this.setCompleted = function(item, completed) {
		item.completed = completed;
		data.updateFlag++;
	};
}
