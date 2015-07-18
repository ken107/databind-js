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
this.setAllCompleted = function(model, completed) {
	for (var i=0; i<model.items.length; i++) model.items[i].completed = completed;
}
this.clearCompleted = function(model) {
	var i=0;
	while (i<model.items.length) {
		if (model.items[i].completed) model.items.splice(i,1);
		else i++;
	}
}
this.setText = function(model, index, text) {
	model.items[index].text = text;
}
