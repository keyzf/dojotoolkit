dojo.provide("dojo.validate.jp");
dojo.require("dojo.validate.common");

/**
  Validates Japanese currency.

  @param value  A string.
  @return  true or false.
*/
dojo.validate.isJapaneseCurrency = function(value) {
	var flags = {
		symbol: "\u00a5",
		cents: false
	};
	return dojo.validate.isCurrency(value, flags);
}


