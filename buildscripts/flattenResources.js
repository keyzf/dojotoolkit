// This little utility is invoked by the build to flatten all of the JSON resource bundles used
// by dojo.requireLocalization(), much like the main build itself, to optimize so that multiple
// web hits will not be necessary to load these resources.  Normally, a request for a particular
// bundle in a locale like "en-us" would result in three web hits: one looking for en_us/ another
// for en/ and another for ROOT/.  All of this multiplied by the number of bundles used can result
// in a lot of web hits and latency.  This script uses Dojo to actually load the resources into
// memory, then flatten the object and spit it out using dojo.json.serialize.  The bootstrap
// will be modified to download exactly one of these files, whichever is closest to the user's
// locale.

// The input {reqFile} is the list of dojo.requireLocalization() commands grepped from a build.
// A list of locales to build is loaded.  Any applicable locales plus all partial locales will
// be generated in the appropriate files at {destDir}/{prefix}_{locale}.js.  Lastly, the list of
// actual translations found and processed is returned as an array in stdout.

var reqFile = arguments[0];
var destDir = arguments[1];
var prefix = arguments[2];
var localeList = arguments[3].split(',');

djConfig={
	locale: 'xx',
	extraLocale: localeList,
	baseRelativePath: "../"
};

load('../dojo.js');

dojo.require("dojo.i18n.common");
dojo.require("dojo.json");

var djLoadedBundles = [];

//TODO: register plain function handler (output source) in jsonRegistry?
var drl = dojo.requireLocalization;
dojo.requireLocalization = function(modulename, bundlename, locale){
	drl(modulename, bundlename, locale);
//TODO: avoid dups?
	djLoadedBundles.push({modulename: modulename, module: eval(modulename), bundlename: bundlename});
};

load(reqFile);

//print("loaded bundles: "+djLoadedBundles.length);

var djBundlesByLocale = {};
var jsLocale, entry, bundle;

for (var i = 0; i < djLoadedBundles.length; i++){
	entry = djLoadedBundles[i];
	bundle = entry.module.nls[entry.bundlename];
	for (jsLocale in bundle){
		if (!djBundlesByLocale[jsLocale]){djBundlesByLocale[jsLocale]=[];}
		djBundlesByLocale[jsLocale].push(entry);
	}
}

localeList = [];

var mkdir = false;
var dir = new java.io.File(destDir);
for (jsLocale in djBundlesByLocale){
	var locale = jsLocale.replace('_', '-');
	if(!mkdir){ dir.mkdir(); mkdir = true; }
	var outFile = new java.io.File(dir, prefix + "_" + locale + ".js");
	var os = new java.io.BufferedWriter(
			new java.io.OutputStreamWriter(new java.io.FileOutputStream(outFile), "utf-8"));
	try{
		os.write("dojo.provide(\"nls.dojo_"+locale+"\");");
		for (var j = 0; j < djLoadedBundles.length; j++){
			entry = djLoadedBundles[j];
			var bundlePkg = [entry.modulename,"nls",entry.bundlename].join(".");
			var translationPkg = [bundlePkg,jsLocale].join(".");
			bundle = entry.module.nls[entry.bundlename];
			if(bundle[jsLocale]){ //FIXME:redundant check?
				os.write("dojo.provide(\""+bundlePkg+"\");");
				os.write(bundlePkg+"._built=true;");
				os.write("dojo.provide(\""+translationPkg+"\");");
				os.write(translationPkg+"="+dojo.json.serialize(bundle[jsLocale])+";");
			}
		}
	}finally{
		os.close();
	}
	localeList.push(locale);
}

print(dojo.json.serialize(localeList));
