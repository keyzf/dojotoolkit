dojo.provide("dojo.date");


/* Supplementary Date Functions
 *******************************/

dojo.date.setDayOfYear = function (dateObject, dayofyear) {
	dateObject.setMonth(0);
	dateObject.setDate(dayofyear);
	return dateObject;
}

dojo.date.getDayOfYear = function (dateObject) {
	var firstDayOfYear = new Date(dateObject.getFullYear(), 0, 1);
	return Math.floor((dateObject.getTime() -
		firstDayOfYear.getTime()) / 86400000);
}




dojo.date.setWeekOfYear = function (dateObject, week, firstDay) {
	if (arguments.length == 1) { firstDay = 0; } // Sunday
	dojo.unimplemented("dojo.date.setWeekOfYear");
}

dojo.date.getWeekOfYear = function (dateObject, firstDay) {
	if (arguments.length == 1) { firstDay = 0; } // Sunday

	// work out the first day of the year corresponding to the week
	var firstDayOfYear = new Date(dateObject.getFullYear(), 0, 1);
	var day = firstDayOfYear.getDay();
	firstDayOfYear.setDate(firstDayOfYear.getDate() -
			day + firstDay - (day > firstDay ? 7 : 0));

	return Math.floor((dateObject.getTime() -
		firstDayOfYear.getTime()) / 604800000);
}




dojo.date.setIsoWeekOfYear = function (dateObject, week, firstDay) {
	if (arguments.length == 1) { firstDay = 1; } // Monday
	dojo.unimplemented("dojo.date.setIsoWeekOfYear");
}

dojo.date.getIsoWeekOfYear = function (dateObject, firstDay) {
	if (arguments.length == 1) { firstDay = 1; } // Monday
	dojo.unimplemented("dojo.date.getIsoWeekOfYear");
}




/* ISO 8601 Functions
 *********************/

dojo.date.setIso8601 = function (dateObject, string){
	var comps = (string.indexOf("T") == -1) ? string.split(" ") : string.split("T");
	dojo.date.setIso8601Date(dateObject, comps[0]);
	if (comps.length == 2) { dojo.date.setIso8601Time(dateObject, comps[1]); }
	return dateObject;
}

dojo.date.fromIso8601 = function (string) {
	return dojo.date.setIso8601(new Date(0, 0), string);
}




dojo.date.setIso8601Date = function (dateObject, string) {
	var regexp = "^([0-9]{4})((-?([0-9]{2})(-?([0-9]{2}))?)|" +
			"(-?([0-9]{3}))|(-?W([0-9]{2})(-?([1-7]))?))?$";
	var d = string.match(new RegExp(regexp));
	if(!d) {
		dojo.debug("invalid date string: " + string);
		return false;
	}
	var year = d[1];
	var month = d[4];
	var date = d[6];
	var dayofyear = d[8];
	var week = d[10];
	var dayofweek = (d[12]) ? d[12] : 1;

	dateObject.setYear(year);
	
	if (dayofyear) { dojo.date.setDayOfYear(dateObject, Number(dayofyear)); }
	else if (week) {
		dateObject.setMonth(0);
		dateObject.setDate(1);
		var gd = dateObject.getDay();
		var day =  (gd) ? gd : 7;
		var offset = Number(dayofweek) + (7 * Number(week));
		
		if (day <= 4) { dateObject.setDate(offset + 1 - day); }
		else { dateObject.setDate(offset + 8 - day); }
	} else {
		if (month) { 
			dateObject.setDate(1);
			dateObject.setMonth(month - 1); 
		}
		if (date) { dateObject.setDate(date); }
	}
	
	return dateObject;
}

dojo.date.fromIso8601Date = function (string) {
	return dojo.date.setIso8601Date(new Date(0, 0), string);
}




dojo.date.setIso8601Time = function (dateObject, string) {
	// first strip timezone info from the end
	var timezone = "Z|(([-+])([0-9]{2})(:?([0-9]{2}))?)$";
	var d = string.match(new RegExp(timezone));

	var offset = 0; // local time if no tz info
	if (d) {
		if (d[0] != 'Z') {
			offset = (Number(d[3]) * 60) + Number(d[5]);
			offset *= ((d[2] == '-') ? 1 : -1);
		}
		offset -= dateObject.getTimezoneOffset();
		string = string.substr(0, string.length - d[0].length);
	}

	// then work out the time
	var regexp = "^([0-9]{2})(:?([0-9]{2})(:?([0-9]{2})(\.([0-9]+))?)?)?$";
	var d = string.match(new RegExp(regexp));
	if(!d) {
		dojo.debug("invalid time string: " + string);
		return false;
	}
	var hours = d[1];
	var mins = Number((d[3]) ? d[3] : 0);
	var secs = (d[5]) ? d[5] : 0;
	var ms = d[7] ? (Number("0." + d[7]) * 1000) : 0;

	dateObject.setHours(hours);
	dateObject.setMinutes(mins);
	dateObject.setSeconds(secs);
	dateObject.setMilliseconds(ms);

	if (offset != 0) {
		dateObject.setTime(dateObject.getTime() + offset * 60000);
	}	
	return dateObject;
}

dojo.date.fromIso8601Time = function (string) {
	return dojo.date.setIso8601Time(new Date(0, 0), string);
}



/* Informational Functions
 **************************/

dojo.date.shortTimezones = ["IDLW", "BET", "HST", "MART", "AKST", "PST", "MST",
	"CST", "EST", "AST", "NFT", "BST", "FST", "AT", "GMT", "CET", "EET", "MSK",
	"IRT", "GST", "AFT", "AGTT", "IST", "NPT", "ALMT", "MMT", "JT", "AWST",
	"JST", "ACST", "AEST", "LHST", "VUT", "NFT", "NZT", "CHAST", "PHOT",
	"LINT"];
dojo.date.timezoneOffsets = [-720, -660, -600, -570, -540, -480, -420, -360,
	-300, -240, -210, -180, -120, -60, 0, 60, 120, 180, 210, 240, 270, 300,
	330, 345, 360, 390, 420, 480, 540, 570, 600, 630, 660, 690, 720, 765, 780,
	840];
/*
dojo.date.timezones = ["International Date Line West", "Bering Standard Time",
	"Hawaiian Standard Time", "Marquesas Time", "Alaska Standard Time",
	"Pacific Standard Time (USA)", "Mountain Standard Time",
	"Central Standard Time (USA)", "Eastern Standard Time (USA)",
	"Atlantic Standard Time", "Newfoundland Time", "Brazil Standard Time",
	"Fernando de Noronha Standard Time (Brazil)", "Azores Time",
	"Greenwich Mean Time", "Central Europe Time", "Eastern Europe Time",
	"Moscow Time", "Iran Standard Time", "Gulf Standard Time",
	"Afghanistan Time", "Aqtobe Time", "Indian Standard Time", "Nepal Time",
	"Almaty Time", "Myanmar Time", "Java Time",
	"Australian Western Standard Time", "Japan Standard Time",
	"Australian Central Standard Time", "Lord Hove Standard Time (Australia)",
	"Vanuata Time", "Norfolk Time (Australia)", "New Zealand Standard Time",
	"Chatham Standard Time (New Zealand)", "Phoenix Islands Time (Kribati)",
	"Line Islands Time (Kribati)"];
*/

dojo.date.getDaysInMonth = function (dateObject) {
	var month = dateObject.getMonth();
	var days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	if (month == 1 && dojo.date.isLeapYear(dateObject)) { return 29; }
	else { return days[month]; }
}

dojo.date.isLeapYear = function (dateObject) {
	/*
	 * Leap years are years with an additional day YYYY-02-29, where the year
	 * number is a multiple of four with the following exception: If a year
	 * is a multiple of 100, then it is only a leap year if it is also a
	 * multiple of 400. For example, 1900 was not a leap year, but 2000 is one.
	 */
	var year = dateObject.getFullYear();
	return (year%400 == 0) ? true : (year%100 == 0) ? false : (year%4 == 0) ? true : false;
}



dojo.date.getDayName = function (dateObject) {
	return dojo.deprecated("dojo.date.getDayName", "Use dojo.i18n.datetime.getDayName instead", "0.5");
}

dojo.date.getDayShortName = function (dateObject) {
	return dojo.deprecated("dojo.date.getDayShortName", "Use dojo.i18n.datetime.getDayShortName instead", "0.5");
}

dojo.date.getMonthName = function (dateObject) {
	return dojo.deprecated("dojo.date.getMonthName", "Use dojo.i18n.datetime.getMonthName instead", "0.5");
}

dojo.date.getMonthShortName = function (dateObject) {
	return dojo.deprecated("dojo.date.getMonthShortName", "Use dojo.i18n.datetime.getMonthShortName instead", "0.5");
}



dojo.date.getTimezoneName = function (dateObject) {
	// need to negate timezones to get it right 
	// i.e UTC+1 is CET winter, but getTimezoneOffset returns -60
	var timezoneOffset = -(dateObject.getTimezoneOffset());
	
	for (var i = 0; i < dojo.date.timezoneOffsets.length; i++) {
		if (dojo.date.timezoneOffsets[i] == timezoneOffset) {
			return dojo.date.shortTimezones[i];
		}
	}
	
	// we don't know so return it formatted as "+HH:MM"
	function $ (s) { s = String(s); while (s.length < 2) { s = "0" + s; } return s; }
	return (timezoneOffset < 0 ? "-" : "+") + $(Math.floor(Math.abs(
		timezoneOffset)/60)) + ":" + $(Math.abs(timezoneOffset)%(60));
}



//FIXME: not localized
dojo.date.getOrdinal = function (dateObject) {
	var date = dateObject.getDate();

	if (date%100 != 11 && date%(10) == 1) { return "st"; }
	else if (date%100 != 12 && date%(10) == 2) { return "nd"; }
	else if (date%100 != 13 && date%(10) == 3) { return "rd"; }
	else { return "th"; }
}



/* Date Formatter Functions
 ***************************/

// POSIX strftime
// see <http://www.opengroup.org/onlinepubs/007908799/xsh/strftime.html>
dojo.date.format = dojo.date.strftime = function (dateObject, format) {

	// zero pad
	var padChar = null;
	function _ (s, n) {
		s = String(s);
		n = (n || 2) - s.length;
		while (n-- > 0) { s = (padChar == null ? "0" : padChar) + s; }
		return s;
	}
	
	function $ (property) {
		switch (property) {
			case "a": // abbreviated weekday name according to the current locale
				return dojo.date.getDayShortName(dateObject); break;

			case "A": // full weekday name according to the current locale
				return dojo.date.getDayName(dateObject); break;

			case "b":
			case "h": // abbreviated month name according to the current locale
				return dojo.date.getMonthShortName(dateObject); break;
				
			case "B": // full month name according to the current locale
				return dojo.date.getMonthName(dateObject); break;
				
			case "c": // preferred date and time representation for the current
				      // locale
				return dateObject.toLocaleString(); break;

			case "C": // century number (the year divided by 100 and truncated
				      // to an integer, range 00 to 99)
				return _(Math.floor(dateObject.getFullYear()/100)); break;
				
			case "d": // day of the month as a decimal number (range 01 to 31)
				return _(dateObject.getDate()); break;
				
			case "D": // same as %m/%d/%y
				return $("m") + "/" + $("d") + "/" + $("y"); break;
					
			case "e": // day of the month as a decimal number, a single digit is
				      // preceded by a space (range ' 1' to '31')
				if (padChar == null) { padChar = " "; }
				return _(dateObject.getDate(), 2); break;
			
			case "f": // month as a decimal number, a single digit is
							// preceded by a space (range ' 1' to '12')
				if (padChar == null) { padChar = " "; }
				return _(dateObject.getMonth()+1, 2); break;				
			
			case "g": // like %G, but without the century.
				break;
			
			case "G": // The 4-digit year corresponding to the ISO week number
				      // (see %V).  This has the same format and value as %Y,
				      // except that if the ISO week number belongs to the
				      // previous or next year, that year is used instead.
				break;
			
			case "F": // same as %Y-%m-%d
				return $("Y") + "-" + $("m") + "-" + $("d"); break;
				
			case "H": // hour as a decimal number using a 24-hour clock (range
				      // 00 to 23)
				return _(dateObject.getHours()); break;
				
			case "I": // hour as a decimal number using a 12-hour clock (range
				      // 01 to 12)
				return _(dateObject.getHours() % 12 || 12); break;
				
			case "j": // day of the year as a decimal number (range 001 to 366)
				return _(dojo.date.getDayOfYear(dateObject), 3); break;
				
			case "m": // month as a decimal number (range 01 to 12)
				return _(dateObject.getMonth() + 1); break;
				
			case "M": // minute as a decimal numbe
				return _(dateObject.getMinutes()); break;
			
			case "n":
				return "\n"; break;

			case "p": // either `am' or `pm' according to the given time value,
				      // or the corresponding strings for the current locale
				return dateObject.getHours() < 12 ? "am" : "pm"; break;
				
			case "r": // time in a.m. and p.m. notation
				return $("I") + ":" + $("M") + ":" + $("S") + " " + $("p"); break;
				
			case "R": // time in 24 hour notation
				return $("H") + ":" + $("M"); break;
				
			case "S": // second as a decimal number
				return _(dateObject.getSeconds()); break;

			case "t":
				return "\t"; break;

			case "T": // current time, equal to %H:%M:%S
				return $("H") + ":" + $("M") + ":" + $("S"); break;
				
			case "u": // weekday as a decimal number [1,7], with 1 representing
				      // Monday
				return String(dateObject.getDay() || 7); break;
				
			case "U": // week number of the current year as a decimal number,
				      // starting with the first Sunday as the first day of the
				      // first week
				return _(dojo.date.getWeekOfYear(dateObject)); break;

			case "V": // week number of the year (Monday as the first day of the
				      // week) as a decimal number [01,53]. If the week containing
				      // 1 January has four or more days in the new year, then it 
				      // is considered week 1. Otherwise, it is the last week of 
				      // the previous year, and the next week is week 1.
				return _(dojo.date.getIsoWeekOfYear(dateObject)); break;
				
			case "W": // week number of the current year as a decimal number,
				      // starting with the first Monday as the first day of the
				      // first week
				return _(dojo.date.getWeekOfYear(dateObject, 1)); break;
				
			case "w": // day of the week as a decimal, Sunday being 0
				return String(dateObject.getDay()); break;

			case "x": // preferred date representation for the current locale
				      // without the time
				break;

			case "X": // preferred date representation for the current locale
				      // without the time
				break;

			case "y": // year as a decimal number without a century (range 00 to
				      // 99)
				return _(dateObject.getFullYear()%100); break;
				
			case "Y": // year as a decimal number including the century
				return String(dateObject.getFullYear()); break;
			
			case "z": // time zone or name or abbreviation
				var timezoneOffset = dateObject.getTimezoneOffset();
				return (timezoneOffset > 0 ? "-" : "+") + 
					_(Math.floor(Math.abs(timezoneOffset)/60)) + ":" +
					_(Math.abs(timezoneOffset)%60); break;
				
			case "Z": // time zone or name or abbreviation
				return dojo.date.getTimezoneName(dateObject); break;
			
			case "%":
				return "%"; break;
		}
	}

	// parse the formatting string and construct the resulting string
	var string = "";
	var i = 0, index = 0, switchCase;
	while ((index = format.indexOf("%", i)) != -1) {
		string += format.substring(i, index++);
		
		// inspect modifier flag
		switch (format.charAt(index++)) {
			case "_": // Pad a numeric result string with spaces.
				padChar = " "; break;
			case "-": // Do not pad a numeric result string.
				padChar = ""; break;
			case "0": // Pad a numeric result string with zeros.
				padChar = "0"; break;
			case "^": // Convert characters in result string to upper case.
				switchCase = "upper"; break;
			case "#": // Swap the case of the result string.
				switchCase = "swap"; break;
			default: // no modifer flag so decremenet the index
				padChar = null; index--; break;
		}

		// toggle case if a flag is set
		var property = $(format.charAt(index++));
		if (switchCase == "upper" ||
			(switchCase == "swap" && /[a-z]/.test(property))) {
			property = property.toUpperCase();
		} else if (switchCase == "swap" && !/[a-z]/.test(property)) {
			property = property.toLowerCase();
		}
		var swicthCase = null;
		
		string += property;
		i = index;
	}
	string += format.substring(i);
	
	return string;
}

/* compare and add
 ******************/
dojo.date.compareTypes={
	// 	summary
	//	bitmask for comparison operations.
	DATE:1, TIME:2 
};
dojo.date.compare=function(/* Date */ dateA, /* Date */ dateB, /* int */ options){
	//	summary
	//	Compare two date objects by date, time, or both.
	var dA=dateA;
	var dB=dateB||new Date();
	var now=new Date();
	var opt=options||(dojo.date.compareTypes.DATE|dojo.date.compareTypes.TIME);
	var d1=new Date(
		((opt&dojo.date.compareTypes.DATE)?(dA.getFullYear()):now.getFullYear()), 
		((opt&dojo.date.compareTypes.DATE)?(dA.getMonth()):now.getMonth()), 
		((opt&dojo.date.compareTypes.DATE)?(dA.getDate()):now.getDate()), 
		((opt&dojo.date.compareTypes.TIME)?(dA.getHours()):0), 
		((opt&dojo.date.compareTypes.TIME)?(dA.getMinutes()):0), 
		((opt&dojo.date.compareTypes.TIME)?(dA.getSeconds()):0)
	);
	var d2=new Date(
		((opt&dojo.date.compareTypes.DATE)?(dB.getFullYear()):now.getFullYear()), 
		((opt&dojo.date.compareTypes.DATE)?(dB.getMonth()):now.getMonth()), 
		((opt&dojo.date.compareTypes.DATE)?(dB.getDate()):now.getDate()), 
		((opt&dojo.date.compareTypes.TIME)?(dB.getHours()):0), 
		((opt&dojo.date.compareTypes.TIME)?(dB.getMinutes()):0), 
		((opt&dojo.date.compareTypes.TIME)?(dB.getSeconds()):0)
	);
	if(d1.valueOf()>d2.valueOf()){
		return 1;	//	int
	}
	if(d1.valueOf()<d2.valueOf()){
		return -1;	//	int
	}
	return 0;	//	int
}

dojo.date.dateParts={ 
	//	summary
	//	constants for use in dojo.date.add
	YEAR:0, MONTH:1, DAY:2, HOUR:3, MINUTE:4, SECOND:5, MILLISECOND:6 
};
dojo.date.add=function(/* Date */ d, /* dojo.date.dateParts */ unit, /* int */ amount){
	var n=(amount)?amount:1;
	var v;
	switch(unit){
		case dojo.date.dateParts.YEAR:{
			v=new Date(d.getFullYear()+n, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
			break;
		}
		case dojo.date.dateParts.MONTH:{
			v=new Date(d.getFullYear(), d.getMonth()+n, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
			break;
		}
		case dojo.date.dateParts.HOUR:{
			v=new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()+n, d.getMinutes(), d.getSeconds(), d.getMilliseconds());
			break;
		}
		case dojo.date.dateParts.MINUTE:{
			v=new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()+n, d.getSeconds(), d.getMilliseconds());
			break;
		}
		case dojo.date.dateParts.SECOND:{
			v=new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()+n, d.getMilliseconds());
			break;
		}
		case dojo.date.dateParts.MILLISECOND:{
			v=new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()+n);
			break;
		}
		default:{
			v=new Date(d.getFullYear(), d.getMonth(), d.getDate()+n, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
		}
	};
	return v;	//	Date
};

/**
 *
 * Returns a string of the date relative to the current date.
 *
 * @param date The date object
 *
 * Example returns:
 * - "1 minute ago"
 * - "4 minutes ago"
 * - "Yesterday"
 * - "2 days ago"
 */
//FIXME: not localized
dojo.date.toRelativeString = function(date) {
	var now = new Date();
	var diff = (now - date) / 1000;
	var end = " ago";
	var future = false;
	if(diff < 0) {
		future = true;
		end = " from now";
		diff = -diff;
	}

	if(diff < 60) {
		diff = Math.round(diff);
		return diff + " second" + (diff == 1 ? "" : "s") + end;
	}
	if(diff < 60*60) {
		diff = Math.round(diff/60);
		return diff + " minute" + (diff == 1 ? "" : "s") + end;
	}
	if(diff < 60*60*24) {
		diff = Math.round(diff/3600);
		return diff + " hour" + (diff == 1 ? "" : "s") + end;
	}
	if(diff < 60*60*24*7) {
		diff = Math.round(diff/(3600*24));
		if(diff == 1) {
			return future ? "Tomorrow" : "Yesterday";
		} else {
			return diff + " days" + end;
		}
	}
	return dojo.date.toShortDateString(date);
}

/**
 * Convert a Date to a SQL string, optionally ignoring the HH:MM:SS portion of the Date
 */
dojo.date.toSql = function(date, noTime) {
	return dojo.date.format(date, "%F" + !noTime ? " %T" : "");
}

/**
 * Convert a SQL date string to a JavaScript Date object
 */
dojo.date.fromSql = function(sqlDate) {
	var parts = sqlDate.split(/[\- :]/g);
	while(parts.length < 6) {
		parts.push(0);
	}
	return new Date(parts[0], (parseInt(parts[1],10)-1), parts[2], parts[3], parts[4], parts[5]);
}

