/*
 SOURCE: http://jslib.mozdev.org/libraries/utils/sax.js.html
 LICENSE: http://www.mozilla.org/MPL/MPL-1.1.html
 LICENSE FAQ: http://www.mozilla.org/MPL/mpl-faq.html
 */
dojo.provide("dojox.xml.SaxParser");

dojo.declare("dojox.xml.SaxParser", null, {
    _docStarted: false,
	_buffer: "",
    curr: 0,
	
	_cdataRunning: false,
	_cdataBuffer: "",
	
    constructor: function(dontUnescapeEntities){
        this.cname = [];
		if (dontUnescapeEntities) {
			this.unescapeEntities = function(stringData){
				return stringData;
			}
		} else {
			this.unescapeEntities = function(stringData){
				// This should be replaced with a good regex
				
				stringData = stringData.split("&lt;").join("<");
				stringData = stringData.split("&gt;").join(">");
				stringData = stringData.split("&quot;").join("\"");
				stringData = stringData.split("&apos;").join("\'");
				stringData = stringData.split("&amp;").join("&");
				return stringData;
			}
		}
    },
	
	// The following functions are the ones external scripts can dojo.connect to to get notifications when parsing is happening.
	onDocumentStart: function() {},
	onCdataCharacters: function(characters) {},
	onDocumentEnd: function() {},
	onStartElement: function(nodeName, attributes) {},
	onEndElement: function(nodeName) {},
	
    /**
     * parse(aData)
     *
     * aData is the data that you what parsed.  This can be in
     * chunks or whole.
     *
     */
    parse: function(aData){
        this._buffer += aData;
        
        if (!this._docStarted) {
			// strip prolog
            var start = this._buffer.indexOf("<");
            if (this._buffer.substring(start, start + 3) == "<?x" || this._buffer.substring(start, start + 3) == "<?X") {
                var close = this._buffer.indexOf("?>");
                if (close == -1) {
                    return;
                }
                this._buffer = this._buffer.substring(close + 2, this._buffer.length);
            }
            this._docStarted = true;
            this.onDocumentStart();
        }
        
        // keep circling and eating the str
        while (1) {
            if (this._buffer.length == 0) {
                return;
            }
            // check if we are in <![CDATA[ mode
            if (this._cdataRunning) {
                var CDATA_end = this._buffer.indexOf("]]>");
                if (CDATA_end == -1) {
                    this._cdataBuffer += this._buffer;
                    this._buffer = "";
                    continue;
                } else {
                    this._cdataBuffer += this._buffer.substring(0, CDATA_end);
                    this._buffer = this._buffer.substring(CDATA_end + 3, this._buffer.length);
                    this._cdataRunning = false;
					this.onCdataCharacters(this._cdataBuffer);
                    this._cdataBuffer = "";
                    continue;
                }
            }
            
            // then check for closes 
            var eclose = this._buffer.indexOf("</" + this.cname[this.curr] + ">");
            if (eclose == 0) {
                this._buffer = this._buffer.substring(this.cname[this.curr].length + 3, this._buffer.length);
				this.onEndElement(this.cname[this.curr]);
                this.curr--;
                if (this.curr == 0) {
                    this._docStarted = false;
					this.onDocumentEnd();
                    return;
                }
                continue;
            }
            
            // check for <![CDATA[ start
            if (this._buffer.indexOf("<![CDATA[") == 0) {
                this._cdataRunning = true;
                this._cdataBuffer = "";
                this._buffer = this._buffer.substring(9, this._buffer.length);
                continue;
            }
            
            // check last for tags
            var estart = this._buffer.indexOf("<");
            if (estart == 0) { // new element
                close = this._getEndElementIndex(this._buffer);
                if (close == -1) {
                    return;
                }
                var empty = (this._buffer.substring(close - 1, close) == "/");
                if (empty) {
                    var starttag = this._buffer.substring(1, close - 1);
                } else {
                    starttag = this._buffer.substring(1, close);
                }
                var nextspace = starttag.indexOf(" ");
                var attribs = "", name = "";
                if (nextspace != -1) {
                    name = starttag.substring(0, nextspace);
                    
                    attribs = starttag.substring(nextspace + 1, starttag.length);
                } else {
                    name = starttag;
                }
                
                //      edit by cbas: the attributes string is fine, we don't need an array since it will be re-serialized
                //      this.handler.startElement(name, this.attribution(attribs));
                this.onStartElement(name, this._getAttributesObject(attribs));
                
                if (empty) {
                    this.onEndElement(name);
                } else {
                    this.curr++;
                    this.cname[this.curr] = name;
                }
                
                this._buffer = this._buffer.substring(close + 1, this._buffer.length);
                continue;
            }
            
            // leftovers are cdata
            if (estart == -1) {
                this.onCdataCharacters(this.unescapeEntities(this._buffer));
                this._buffer = "";
            } else {
                this.onCdataCharacters(this.unescapeEntities(this._buffer.substring(0, estart)));
                this._buffer = this._buffer.substring(estart, this._buffer.length);
            }
        }
    },
    
    /**
     * Returns the index or -1 if there is no close to the tag
     */
    _getEndElementIndex: function(aStr){
        var eq = sp = gt = 0;
        
        sp = aStr.indexOf(" ");
        gt = aStr.indexOf(">");
        if (sp < gt) {
            if (sp == -1) {
                return gt;
            }
            if (aStr.charAt(sp + 1) == ">") {
                return sp;
            }
        } else {
            return gt;
        }
        
        // Very temporary fix for the infinite loop.
        var end = 0;
        var len = aStr.length;
        while (end < len && aStr.charAt(end) != ">") 
            end++;
        return end;
    },
    
    /**
     * attribution(aStr)
     *
     * Internal function used to determing the different attributes
     * in a tag.
     *
     * Returns the list of attributes in the tag
     *
     */
    _getAttributesObject: function(aStr){
		return aStr;
		/*
        Currently commented out, since we don't need an object at all
        
        var attribs = {}, ids, eq = id1 = id2 = nextid = val = key = "";
        
        while (1) {
            //dump("in attribution\n");
            eq = aStr.indexOf("=");
            if (aStr.length == 0 || eq == -1) {
                return attribs;
            }
            
            id1 = aStr.indexOf("'");
            id2 = aStr.indexOf('"');
            if ((id1 < id2 && id1 != -1) || id2 == -1) {
                ids = id1;
                id = "'";
            }
            if ((id2 < id1 || id1 == -1) && id2 != -1) {
                ids = id2;
                id = '"';
            }
            
            nextid = aStr.indexOf(id, ids + 1);
            val = aStr.substring(ids + 1, nextid);
            key = aStr.substring(0, eq);
            
            // strip whitespace
            ws = key.split("\n");
            key = ws.join("");
            ws = key.split(" ");
            key = ws.join("");
            ws = key.split("\t");
            key = ws.join("");
            
            attribs[key] = this.unescapeEntities(val);
            aStr = aStr.substring(nextid + 1, aStr.length);
        }
        
        return attribs;
        */
    },
});
