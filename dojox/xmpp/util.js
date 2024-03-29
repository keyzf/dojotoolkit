dojo.provide("dojox.xmpp.util");
dojo.require("dojox.string.Builder");
dojo.require("dojox.encoding.base64");

dojox.xmpp.util.xmlEncode = function(str) {
	if(str) {
		str = str.replace("&", "&amp;").replace(">", "&gt;").replace("<", "&lt;").replace("'", "&apos;").replace('"', "&quot;");
	}
	return str;
}

dojox.xmpp.util.encodeJid = function(jid) {
		var nodeLength = jid.indexOf("@");
		var buffer = new dojox.string.Builder();
		for(var i =0; i < nodeLength; i++) {
			var ch = jid.charAt(i);
			var rep = ch;
			switch(ch){
				case ' ' : 
					rep = "\\20";
				break;
				case '"' :
					rep = "\\22"; 
				break;
				case "'" :
					rep = "\\27"; 
				break;
				case '/' :
					rep = "\\2f"; 
				break;
				case ':' :
					rep = "\\3a"; 
				break;
				case '<' :
					rep = "\\3c"; 
				break;
				case '>' :
					rep = "\\3e"; 
				break;
				// this case is actually useless, but we include it for the sake
				// of completeness
				case '@' :
					rep = "\\40";
				break;
				case '\\' :
					rep = "\\5c";
				break;
			}
			buffer.append(rep);
		}
		buffer.append(jid.substring(nodeLength, jid.length));
		return buffer.toString();
	}

dojox.xmpp.util.decodeJid = function(jid) {
	var nodeLength = jid.indexOf("@");
	var node = jid.substring(0, nodeLength);
	node = node.replace(/\\([23][02367acef])/g, function(match) {
			switch(match){
				case "\\20" : 
					return  ' ';
				case "\\22"  :
					return '"'; 
				case "\\26" :
					return  '&'; 
				case "\\27" :
					return   "'"; 
				case "\\2f" :
					return  '/'; 
				case "\\3a" :
					return ':' ; 
				case "\\3c" :
					return  '<'; 
				case "\\3e" :
					return  '>';
				case "\\40" :
					return '@' ;
				case "\\5c" :
					return '\\' ;
			}
			return "ARG";
	});
	
	return node + jid.substring(nodeLength, jid.length);
}


dojox.xmpp.util.createElement = function(tag, attributes, terminal){
	var elem = new dojox.string.Builder("<");
	elem.append(tag + " ");

	for (var attr in attributes){
		elem.append(attr + '="');
		elem.append(attributes[attr]);
		elem.append('" ');
	}	
	
	if (terminal){
		elem.append("/>");		
	}else{
		elem.append(">");
	}

	return elem.toString();
}

dojox.xmpp.util.stripHtml = function(str){
	// summary
	//		Strips all HTML, including attributes and brackets
	//		| <div onmouse="doBadThing()">Click <b>Me</b></div>
	//		| becomes: Click Me
	var re=/<[^>]*?>/gi;
	for (var i=0; i<arguments.length; i++) {}
	return str.replace(re, "");
}

dojox.xmpp.util.decodeHtmlEntities = function(str){
	// Summary: decodes HTML entities to js characters so the string can be 
	// fed to a textarea.value
	var ta = dojo.doc.createElement("textarea");
	ta.innerHTML = str.replace(/</g,"&lt;").replace(/>/g,"&gt;");
	return ta.value;
}

dojox.xmpp.util.htmlToPlain = function(str){
	str = dojox.xmpp.util.decodeHtmlEntities(str);
	str = str.replace(/<br\s*[i\/]{0,1}>/gi,"\n");
	str = dojox.xmpp.util.stripHtml(str);
	return str;
}

dojox.xmpp.util.Base64 = {};

dojox.xmpp.util.Base64.encode = function(input){
	if(window.btoa) {
		return window.btoa(input);
	}
	var s2b = function(s){
		var b = [];
		for(var i = 0; i < s.length; ++i){
			b.push(s.charCodeAt(i));
		}
		return b;
	};
	return dojox.encoding.base64.encode(s2b(input));
}


dojox.xmpp.util.Base64.decode = function(input){
	if(window.atob) {
		return window.atob(input);
	}
	var b2s = function(b){
		var s = [];
		dojo.forEach(b, function(c){ s.push(String.fromCharCode(c)); });
		return s.join("");
	};
	return b2s(dojox.encoding.base64.decode(input));
}

dojox.xmpp.util.getBareJid = function(jid){
	var i = jid.indexOf('/');
	if (i != -1){
		return jid.substring(0, i);
	}
	return jid;
}

dojox.xmpp.util.getNodeFromJid = function(jid){
    var i = jid.indexOf("@");
    if(i !== -1){
        return jid.substring(0, i);
    }
    return "";
}

dojox.xmpp.util.getDomainFromJid = function(jid){
    var i = jid.indexOf("@");
    var j = jid.indexOf("/");
    j = (j === -1) ? jid.length : j;
    return jid.substring((i + 1), j);
}

dojox.xmpp.util.getResourceFromJid = function(jid){
	var i = jid.indexOf('/');
	if (i != -1){
		return jid.substring((i + 1), jid.length);
	}
	return "";
}

dojox.xmpp.util.parseLegacyTimestamp = function(str){
    var match = dojox.xmpp.util.parseLegacyTimestamp.regex.exec(str);
    var result = null;
    if(match){
        match.shift();
        if(match[1]){match[1]--;} // Javascript Date months are 0-based
        result = new Date(match[0]||1970, match[1]||0, match[2]||1, match[3]||0, match[4]||0, match[5]||0);
        var offset = -result.getTimezoneOffset();
        result.setTime(result.getTime() + offset * 60000);
    }
    return result;
}
dojox.xmpp.util.parseLegacyTimestamp.regex = /^(\d{4})(\d{2})(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

dojox.xmpp.util.isErrorNode = function(msg) {
    if(msg.getAttribute('type')=='error'){
        var err = this.processXmppError(msg);
    }else{
        this.onLogin();
    }
}

dojox.xmpp.util.json2xml = function(o){
    // summary:
    //        Json to XML converter, inspired by
    //        http://www.xml.com/pub/a/2006/05/31/converting-between-xml-and-json.html
    var buffer = new dojox.string.Builder();

    function writeObject(o){
        console.log("writeObject called");
        console.info(o);
        var tagname, content;
        for(tagname in o){
            content = o[tagname];
            break;
        }
        if(content instanceof Array){
            // multiple elements of the same name
            dojo.forEach(content, function(item){
                var obj = {};
                obj[tagname] = item;
                writeObject(obj);
            });
        }else if(content === null){
            // empty element
            buffer.append("<" + tagname + "/>");
        }else if(typeof content === "string"){
            // element with nothing but text content
            buffer.append("<" + tagname + ">" + dojox.xmpp.util.xmlEncode(content) + "</" + tagname + ">");
        }else if(typeof content === "object"){
            // complex element, with attributes and child nodes
            var hasNonAttrs = false;
            buffer.append("<" + tagname);
            // attribute nodes
            for(var key in content){
                var value = content[key];
                if(key[0] === "@"){
                    if(value !== null){
                        buffer.append(' ' + key.slice(1) + '="' + dojox.xmpp.util.xmlEncode(value) + '"');
                    }
                }else{
                    hasNonAttrs = true;
                }
            }
            if(!hasNonAttrs){
                // no child nodes, close the element
                buffer.append("/>");
            }else{
                // handle child nodes
                buffer.append(">");
                for(key in content){
                    value = content[key];
                    if(key === "#text"){
                        // text node
                        buffer.append(dojox.xmpp.util.xmlEncode(value));
                    }else if(key[0] !== "@"){
                        // element node
                        var obj = {};
                        obj[key] = value;
                        writeObject(obj);
                    }
                }
                // closing tag
                buffer.append("</" + tagname + ">");
            }
        }
    }

    writeObject(o);
    return buffer.toString();
}
