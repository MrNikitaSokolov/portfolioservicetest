var mongoose = require('mongoose');

module.exports = mongoose.model('Stock', {
	symbol : String,
  name : String,
  open : String,
  close : String,
  change : String,
  low : String,
  high : String
});
