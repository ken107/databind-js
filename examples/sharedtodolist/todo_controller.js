this.init = function(model) {
	model.items = [];
}
this.addItem = function(model, text) {
	console.log(text);
	model.items.push({text: text});
}
this.deleteItem = function(model, index) {
	model.items.splice(index,1);
}
this.setCompleted = function(model, index, completed) {
	model.items[index].completed = completed;
}
this.setText = function(model, index, text) {
	model.items[index].text = text;
}
