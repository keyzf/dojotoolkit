dojo.hostenv.conditionalLoadModule({
	common: ["dojo.io.IO", false, false],
	rhino: ["dojo.io.RhinoIO", false, false],
	browser: [["dojo.io.BrowserIO", false, false], ["dojo.io.Cookies", false, false]]
});
dojo.hostenv.moduleLoaded("dojo.io.*");
